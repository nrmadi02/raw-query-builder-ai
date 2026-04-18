"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type {
  AIResponse,
  ConversationTurn,
  Message,
  QueryResult,
} from "@/types";
import { useAppStore } from "@/store/app-store";
import { useApiFetch } from "@/hooks/use-api-fetch";
import type { ChatHistoryEntry } from "@/store/app-store";
import {
  CONTEXT_TURN_WINDOW,
  CONVERSATION_TITLE_MAX_LENGTH,
  DEFAULT_PAGE_SIZE,
} from "@/constants/stream";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a short human-readable summary of query result row counts.
 * Used as conversation context for the insight generation step.
 */
function buildResultSummary(queries: QueryResult[]): string {
  const parts: string[] = [];
  for (const query of queries) {
    if (query.rows && query.rows.length > 0) {
      const rowCount = query.pagination?.totalRows ?? query.rows.length;
      parts.push(`${query.title}: ${rowCount} baris`);
    }
  }
  return parts.join("; ") || "Tidak ada data";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStreamChat() {
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [streamingInsight, setStreamingInsight] = useState("");
  const [streamingSQL, setStreamingSQL] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  // Refs for values that must be accessed inside async callbacks without stale closures
  const streamingInsightRef = useRef("");
  const fallbackInsightRef = useRef<string | null>(null);
  const responseRef = useRef<AIResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const executeAbortRef = useRef<AbortController | null>(null);

  /**
   * Incremented on every reset/loadConversation to allow pending async operations
   * to detect they are stale and bail out early.
   */
  const sessionRef = useRef(0);

  const addChatEntry = useAppStore((state) => state.addChatEntry);
  const apiFetch = useApiFetch();
  const conversationTurns = useAppStore((state) => state.conversationTurns);
  const activeConversationId = useAppStore((state) => state.activeConversationId);
  const addTurn = useAppStore((state) => state.addTurn);
  const updateLastAssistantTurn = useAppStore((state) => state.updateLastAssistantTurn);
  const setConversationId = useAppStore((state) => state.setConversationId);
  const clearConversation = useAppStore((state) => state.clearConversation);

  // Abort any in-flight requests when the component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      executeAbortRef.current?.abort();
    };
  }, []);

  /**
   * Resets all streaming-related React state to its initial values.
   * Extracted to avoid duplication between `reset` and `loadConversation`.
   */
  const resetStreamState = useCallback((): void => {
    setLoading(false);
    setLoadingStep("");
    setError(null);
    setStreamingSQL("");
    setStreamingInsight("");
    setSelectedTables([]);
  }, []);

  /** Aborts all in-flight streaming and execution requests. */
  const cancel = useCallback((): void => {
    abortControllerRef.current?.abort();
    executeAbortRef.current?.abort();
    setLoading(false);
    setLoadingStep("");
    setError(null);
  }, []);

  /**
   * Executes the provided SQL queries in parallel against the remote database.
   * Results are applied to state only if the session has not changed (stale-check).
   */
  const executeQueries = useCallback(
    async (
      queries: QueryResult[],
      signal: AbortSignal,
      sessionKey: number,
    ): Promise<{ index: number; status: string; error?: string; rows?: unknown[] }[]> => {
      setLoadingStep("Mengeksekusi query...");

      // Mark all queries as "executing" if session is still valid
      if (sessionRef.current === sessionKey) {
        setResponse((prev) =>
          prev
            ? { ...prev, queries: prev.queries.map((q) => ({ ...q, status: "executing" as const })) }
            : null,
        );
      }

      const executePromises = queries.map(async (query, index) => {
        if (!query.sql || query.sql.trim() === "" || query.validationError) {
          return {
            index,
            status: "error" as const,
            error: query.validationError ?? "SQL kosong atau tidak valid",
          };
        }

        try {
          const res = await fetch("/api/chat/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sql: query.sql,
              page: 1,
              pageSize: DEFAULT_PAGE_SIZE,
              database: "remote",
            }),
            signal,
          });
          const data = await res.json() as { error?: string; rows?: unknown[]; columns?: string[]; executionTimeMs?: number; pagination?: unknown };

          if (data.error) {
            return { index, status: "error" as const, error: data.error };
          }
          return {
            index,
            status: "completed" as const,
            rows: data.rows,
            columns: data.columns ?? query.columns,
            executionTimeMs: data.executionTimeMs,
            pagination: data.pagination,
          };
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return { index, status: "error" as const, error: "Dibatalkan" };
          }
          const message = err instanceof Error ? err.message : "Gagal menjalankan query";
          return { index, status: "error" as const, error: message };
        }
      });

      const results = await Promise.all(executePromises);

      // Bail out if the session changed while queries were running
      if (sessionRef.current !== sessionKey) return results;

      const applyResults = (currentQueries: QueryResult[]): QueryResult[] =>
        currentQueries.map((q, i) => {
          const result = results.find((r) => r.index === i);
          if (!result) return q;
          if (result.status === "error") {
            return { ...q, status: "error" as const, queryError: result.error ?? null, rows: [] };
          }
          return {
            ...q,
            status: "completed" as const,
            rows: result.rows as Record<string, unknown>[],
            columns: (result as { columns?: string[] }).columns ?? q.columns,
            executionTimeMs: (result as { executionTimeMs?: number }).executionTimeMs,
            queryError: null,
            pagination: (result as { pagination?: QueryResult["pagination"] }).pagination,
          };
        });

      setResponse((prev) => (prev ? { ...prev, queries: applyResults(prev.queries) } : null));

      if (responseRef.current) {
        responseRef.current = {
          ...responseRef.current,
          queries: applyResults(responseRef.current.queries),
        };
      }

      return results;
    },
    [],
  );

  /**
   * Streams an AI-generated insight for the given query results.
   * Returns the complete insight text, or null if generation failed/was aborted.
   */
  const generateInsight = useCallback(
    async (
      userQuestion: string,
      queriesWithRows: QueryResult[],
      signal: AbortSignal,
      conversationContext?: string,
    ): Promise<string | null> => {
      const queriesWithData = queriesWithRows.filter(
        (q) => q.rows && q.rows.length > 0,
      );

      if (queriesWithData.length === 0) return null;

      setLoadingStep("Menganalisis data...");

      try {
        const res = await fetch("/api/chat/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_question: userQuestion,
            query_results: queriesWithData.map((q) => ({
              title: q.title,
              rows: q.rows,
            })),
            conversation_context: conversationContext ?? null,
          }),
          signal,
        });

        if (!res.ok) {
          console.error("[Insight] API returned", res.status);
          return null;
        }

        const reader = res.body?.getReader();
        if (!reader) return null;

        const decoder = new TextDecoder();
        let buffer = "";
        let insightText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.trim()) continue;
            const lines = part.split("\n");
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("data:")) dataStr = line.slice(5).trim();
            }
            if (!dataStr || dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr) as { content?: string };
              if (parsed.content) {
                insightText += parsed.content;
                streamingInsightRef.current = insightText;
                setStreamingInsight(insightText);
              }
            } catch {
              // Skip invalid JSON chunks
            }
          }
        }

        return insightText;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return null;
        console.error("Insight generation failed:", err);
        return null;
      }
    },
    [],
  );

  /**
   * Submits a user prompt, triggering the full pipeline:
   * 1. Stream SQL generation
   * 2. Parallel query execution
   * 3. Insight generation
   * 4. Persist to database
   */
  const submit = useCallback(
    async (prompt: string): Promise<void> => {
      // Cancel any in-flight operations from the previous submit
      abortControllerRef.current?.abort();
      executeAbortRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const executeAbort = new AbortController();
      executeAbortRef.current = executeAbort;

      setLoading(true);
      setError(null);
      setResponse(null);
      setStreamingInsight("");
      setStreamingSQL("");
      setSelectedTables([]);
      setLoadingStep("Menghubungkan ke AI...");
      streamingInsightRef.current = "";

      // Add the user prompt as a conversation turn
      const userTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };
      addTurn(userTurn);

      // Read from store directly to avoid stale closure with conversationTurns
      const currentTurns = [...useAppStore.getState().conversationTurns, userTurn];
      const messages: Message[] = currentTurns.map((turn) => ({
        role: turn.role,
        content: turn.content,
      }));

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, conversationTurns: currentTurns }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          if (res.status === 429) {
            const errData = await res.json().catch(() => null) as { resetIn?: number } | null;
            const retryAfter = errData?.resetIn
              ? Math.ceil(errData.resetIn / 1000)
              : Number(res.headers.get("Retry-After")) || 60;
            throw new Error(`Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`);
          }
          if (res.status === 401) {
            throw new Error("Sesi telah berakhir. Silakan login kembali.");
          }
          const contentType = res.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errData = await res.json().catch(() => null) as { error?: string } | null;
            throw new Error(errData?.error ?? "Terjadi kesalahan dari sisi server");
          }
          throw new Error((await res.text()) || "Terjadi kesalahan dari sisi server");
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Failed to get response reader");

        const decoder = new TextDecoder();
        let buffer = "";

        // Parse SSE stream from the Next.js stream route
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (!part.trim()) continue;

            const lines = part.split("\n");
            let eventType = "";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event:")) eventType = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr = line.slice(5).trim();
            }

            if (!eventType || !dataStr) continue;

            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;

              switch (eventType) {
                case "step":
                  setLoadingStep(data.message as string);
                  break;
                case "tables_selected":
                  setSelectedTables((data.tables as string[]) ?? []);
                  break;
                case "sql_chunk":
                  setStreamingSQL((prev) => prev + ((data.content as string) ?? ""));
                  break;
                case "metadata": {
                  const newResponse: AIResponse = {
                    explanation: data.explanation as string,
                    insight: null,
                    queries: data.queries as QueryResult[],
                  };
                  setResponse(newResponse);
                  responseRef.current = newResponse;
                  fallbackInsightRef.current = (data.fallbackInsight as string) ?? null;
                  break;
                }
                case "error":
                  setError(data.message as string);
                  break;
              }
            } catch {
              // Skip invalid JSON frames
            }
          }
        }

        if (abortController.signal.aborted) return;

        // Capture session key here to detect staleness in subsequent async steps
        const currentSession = sessionRef.current;

        // Phase 2: Execute all generated queries in parallel
        const currentResponse = responseRef.current;
        if (
          currentResponse &&
          currentResponse.queries.length > 0 &&
          !currentResponse.queries.some((q) => q.validationError)
        ) {
          await executeQueries(currentResponse.queries, executeAbort.signal, currentSession);
        }

        if (executeAbort.signal.aborted || sessionRef.current !== currentSession) return;

        // Build conversation context for the insight generator (last N assistant turns)
        const conversationContext = currentTurns
          .slice(-CONTEXT_TURN_WINDOW)
          .filter((turn) => turn.role === "assistant")
          .map((turn) =>
            turn.resultSummary ? `${turn.content} (${turn.resultSummary})` : turn.content,
          )
          .join("; ");

        // Phase 3: Generate natural language insight from query results
        const finalResponse = responseRef.current;
        if (finalResponse && sessionRef.current === currentSession) {
          const insight = await generateInsight(
            prompt,
            finalResponse.queries,
            executeAbort.signal,
            conversationContext,
          );

          // Bail out if session changed while insight was generating
          if (sessionRef.current !== currentSession) return;

          const finalInsight = insight ?? fallbackInsightRef.current;
          if (finalInsight) {
            const withInsight = { ...finalResponse, insight: finalInsight };
            setResponse(withInsight);
            responseRef.current = withInsight;
          }
        }

        setLoading(false);
        setLoadingStep("");

        // Phase 4: Persist to database
        if (responseRef.current) {
          const sqls = responseRef.current.queries
            .map((q) => q.sql)
            .filter(Boolean) as string[];
          const summary = buildResultSummary(responseRef.current.queries);

          updateLastAssistantTurn({
            content: responseRef.current.explanation ?? "",
            sql: sqls,
            resultSummary: summary,
          });

          // Create a new conversation on first prompt; reuse existing on follow-ups
          let convId = useAppStore.getState().activeConversationId;
          if (!convId) {
            try {
              const convRes = await apiFetch("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: prompt.slice(0, CONVERSATION_TITLE_MAX_LENGTH),
                  turns: useAppStore.getState().conversationTurns,
                }),
              });
              if (convRes.ok) {
                const convData = await convRes.json() as { conversation: { id: string } };
                convId = convData.conversation.id;
                setConversationId(convId);
              }
            } catch (err) {
              console.error("Failed to create conversation:", err);
            }
          }

          const entry: ChatHistoryEntry = {
            id: crypto.randomUUID(),
            prompt,
            response: responseRef.current,
            timestamp: Date.now(),
            conversationId: convId ?? undefined,
          };

          try {
            const historyRes = await apiFetch("/api/chat-history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt,
                response: entry.response,
                conversationId: convId,
              }),
            });
            if (historyRes.ok) {
              const data = await historyRes.json() as { id: string };
              entry.id = data.id;
            }
          } catch (err) {
            console.error("Failed to save chat history to database:", err);
          }

          addChatEntry(entry);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setLoading(false);
          setLoadingStep("");
          return;
        }
        const message = err instanceof Error ? err.message : "Terjadi kesalahan";
        setError(message);
        setLoading(false);
        setLoadingStep("");
      }
    },
    [
      addChatEntry,
      executeQueries,
      generateInsight,
      conversationTurns,
      activeConversationId,
      addTurn,
      updateLastAssistantTurn,
      setConversationId,
      apiFetch,
    ],
  );

  /** Resets the entire session state and clears the active conversation. */
  const reset = useCallback((): void => {
    abortControllerRef.current?.abort();
    executeAbortRef.current?.abort();
    sessionRef.current += 1; // Invalidate any pending async operations

    resetStreamState();
    setResponse(null);

    // Clear refs
    responseRef.current = null;
    streamingInsightRef.current = "";
    fallbackInsightRef.current = null;

    clearConversation();
  }, [clearConversation, resetStreamState]);

  /**
   * Loads a set of historical chat entries as the active conversation.
   * Reconstructs all conversation turns and displays the last entry's response.
   */
  const loadConversation = useCallback(
    (entries: ChatHistoryEntry[], conversationId?: string): void => {
      // Abort in-flight operations and invalidate their session
      abortControllerRef.current?.abort();
      executeAbortRef.current?.abort();
      sessionRef.current += 1;

      // Clear all stream state refs
      streamingInsightRef.current = "";
      fallbackInsightRef.current = null;
      responseRef.current = null;

      resetStreamState();

      if (!entries || entries.length === 0) {
        setResponse(null);
        useAppStore.getState().setActiveConversation(null, []);
        setHistoryKey((prev) => prev + 1);
        return;
      }

      // Sort entries oldest-first so turns are reconstructed in chronological order
      const sortedEntries = [...entries].sort((a, b) => a.timestamp - b.timestamp);

      // Reconstruct all turns: each entry = 1 user turn + 1 assistant turn
      const turns: ConversationTurn[] = [];
      for (const entry of sortedEntries) {
        turns.push({
          id: crypto.randomUUID(),
          role: "user",
          content: entry.prompt,
          timestamp: entry.timestamp - 1, // Place user turn just before assistant
        });

        if (entry.response) {
          const sqls = entry.response.queries?.map((q) => q.sql).filter(Boolean) as string[];
          const summary = buildResultSummary(entry.response.queries ?? []);
          turns.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: entry.response.explanation ?? "",
            sql: sqls,
            resultSummary: summary,
            timestamp: entry.timestamp,
          });
        }
      }

      // Display the response from the most recent entry
      const lastEntry = sortedEntries[sortedEntries.length - 1];
      const freshResponse = lastEntry.response
        ? { ...lastEntry.response, queries: [...(lastEntry.response.queries ?? [])] }
        : null;

      // Set React state before Zustand to prevent a render with stale response
      responseRef.current = freshResponse;
      setResponse(freshResponse);
      setStreamingInsight(freshResponse?.insight ?? "");
      setHistoryKey((prev) => prev + 1);

      useAppStore.getState().setActiveConversation(conversationId ?? null, turns);
    },
    [resetStreamState],
  );

  return {
    response,
    streamingInsight,
    streamingSQL,
    selectedTables,
    loading,
    loadingStep,
    error,
    historyKey,
    conversationTurns,
    activeConversationId,
    submit,
    cancel,
    reset,
    loadConversation,
  };
}
