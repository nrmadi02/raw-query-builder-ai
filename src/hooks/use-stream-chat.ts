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

function buildResultSummary(queries: QueryResult[]): string {
  const parts: string[] = [];
  for (const q of queries) {
    if (q.rows && q.rows.length > 0) {
      const rowCount = q.pagination?.totalRows ?? q.rows.length;
      parts.push(`${q.title}: ${rowCount} baris`);
    }
  }
  return parts.join("; ") || "Tidak ada data";
}

export function useStreamChat() {
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [streamingInsight, setStreamingInsight] = useState("");
  const [streamingSQL, setStreamingSQL] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const streamingInsightRef = useRef("");
  const fallbackInsightRef = useRef<string | null>(null);
  const responseRef = useRef<AIResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const executeAbortRef = useRef<AbortController | null>(null);
  // Session counter: increment on every loadConversation/reset to invalidate stale async ops
  const sessionRef = useRef(0);

  const addChatEntry = useAppStore((s) => s.addChatEntry);
  const apiFetch = useApiFetch();
  const conversationTurns = useAppStore((s) => s.conversationTurns);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const addTurn = useAppStore((s) => s.addTurn);
  const updateLastAssistantTurn = useAppStore((s) => s.updateLastAssistantTurn);
  const setConversationId = useAppStore((s) => s.setConversationId);
  const clearConversation = useAppStore((s) => s.clearConversation);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      executeAbortRef.current?.abort();
    };
  }, []);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    executeAbortRef.current?.abort();
    setLoading(false);
    setLoadingStep("");
    setError(null);
  }, []);

  const executeQueries = useCallback(
    async (queries: QueryResult[], signal: AbortSignal, sessionKey: number) => {
      setLoadingStep("Mengeksekusi query...");

      // Mark queries as executing only if session is still valid
      if (sessionRef.current === sessionKey) {
        setResponse((prev) =>
          prev
            ? {
                ...prev,
                queries: prev.queries.map((q) => ({
                  ...q,
                  status: "executing" as const,
                })),
              }
            : null,
        );
      }

      const executePromises = queries.map(async (query, index) => {
        if (!query.sql || query.sql.trim() === "" || query.validationError) {
          return {
            index,
            status: "error" as const,
            error: query.validationError || "SQL kosong atau tidak valid",
          };
        }

        try {
          const res = await fetch("/api/chat/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sql: query.sql,
              page: 1,
              pageSize: 10,
              database: "remote",
            }),
            signal,
          });
          const data = await res.json();

          if (data.error) {
            return { index, status: "error" as const, error: data.error };
          }
          return {
            index,
            status: "completed" as const,
            rows: data.rows,
            columns: data.columns || query.columns,
            executionTimeMs: data.executionTimeMs,
            pagination: data.pagination,
          };
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") {
            return { index, status: "error" as const, error: "Dibatalkan" };
          }
          const message =
            err instanceof Error ? err.message : "Gagal menjalankan query";
          return { index, status: "error" as const, error: message };
        }
      });

      const results = await Promise.all(executePromises);

      // Only apply results if this session is still active
      if (sessionRef.current !== sessionKey) return results;

      const updateQueries = (queries: QueryResult[]) =>
        queries.map((q, i) => {
          const result = results.find((r) => r.index === i);
          if (!result) return q;
          if (result.status === "error") {
            return {
              ...q,
              status: "error" as const,
              queryError: result.error,
              rows: [],
            };
          }
          return {
            ...q,
            status: "completed" as const,
            rows: result.rows,
            columns: result.columns || q.columns,
            executionTimeMs: result.executionTimeMs,
            queryError: null,
            pagination: result.pagination,
          };
        });

      setResponse((prev) =>
        prev ? { ...prev, queries: updateQueries(prev.queries) } : null,
      );

      if (responseRef.current) {
        responseRef.current = {
          ...responseRef.current,
          queries: updateQueries(responseRef.current.queries),
        };
      }

      return results;
    },
    [],
  );

  const generateInsight = useCallback(
    async (
      userQuestion: string,
      queriesWithRows: QueryResult[],
      signal: AbortSignal,
      convContext?: string,
    ) => {
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
            conversation_context: convContext || null,
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
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;
            const lines = part.split("\n");
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("data:")) dataStr = line.slice(5).trim();
            }
            if (!dataStr || dataStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) {
                insightText += parsed.content;
                streamingInsightRef.current = insightText;
                setStreamingInsight(insightText);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        return insightText;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return null;
        }
        console.error("Insight generation failed:", err);
        return null;
      }
    },
    [],
  );

  const submit = useCallback(
    async (prompt: string) => {
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

      // Add user turn to conversation
      const userTurn: ConversationTurn = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      };
      addTurn(userTurn);

      // Build messages array from accumulated turns + new message (read from store to avoid stale closure)
      const currentTurns = [
        ...useAppStore.getState().conversationTurns,
        userTurn,
      ];
      const messages: Message[] = currentTurns.map((t) => ({
        role: t.role,
        content: t.content,
      }));

      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages,
            conversationTurns: currentTurns,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          if (res.status === 429) {
            const errData = await res.json().catch(() => null);
            const retryAfter = errData?.resetIn
              ? Math.ceil(errData.resetIn / 1000)
              : Number(res.headers.get("Retry-After")) || 60;
            throw new Error(
              `Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`,
            );
          }
          if (res.status === 401) {
            throw new Error("Sesi telah berakhir. Silakan login kembali.");
          }
          const contentType = res.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errData = await res.json().catch(() => null);
            throw new Error(
              errData?.error || "Terjadi kesalahan dari sisi server",
            );
          }
          throw new Error(
            (await res.text()) || "Terjadi kesalahan dari sisi server",
          );
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response reader");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;

            const lines = part.split("\n");
            let eventType = "";
            let dataStr = "";

            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataStr = line.slice(5).trim();
              }
            }

            if (!eventType || !dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (eventType === "step") {
                setLoadingStep(data.message);
              } else if (eventType === "tables_selected") {
                setSelectedTables(data.tables || []);
              } else if (eventType === "sql_chunk") {
                setStreamingSQL((prev) => prev + (data.content || ""));
              } else if (eventType === "metadata") {
                const newResponse: AIResponse = {
                  explanation: data.explanation,
                  insight: null,
                  queries: data.queries,
                };
                setResponse(newResponse);
                responseRef.current = newResponse;
                fallbackInsightRef.current = data.fallbackInsight || null;
              } else if (eventType === "error") {
                setError(data.message);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }

        if (abortController.signal.aborted) return;

        // Capture session key at this point for stale-check
        const currentSession = sessionRef.current;

        // Phase 2: Execute queries in parallel
        const currentResponse = responseRef.current;
        if (
          currentResponse &&
          currentResponse.queries.length > 0 &&
          !currentResponse.queries.some((q) => q.validationError)
        ) {
          await executeQueries(
            currentResponse.queries,
            executeAbort.signal,
            currentSession,
          );
        }

        if (
          executeAbort.signal.aborted ||
          sessionRef.current !== currentSession
        )
          return;

        // Build conversation context for insight generation
        const convContextForInsight = currentTurns
          .slice(-6)
          .filter((t) => t.role === "assistant")
          .map((t) =>
            t.resultSummary ? `${t.content} (${t.resultSummary})` : t.content,
          )
          .join("; ");

        // Phase 3: Generate insight with real data
        const finalResponse = responseRef.current;
        if (finalResponse && sessionRef.current === currentSession) {
          const insight = await generateInsight(
            prompt,
            finalResponse.queries,
            executeAbort.signal,
            convContextForInsight,
          );

          // Guard: session might have changed while insight was generating
          if (sessionRef.current !== currentSession) return;

          const finalInsight = insight || fallbackInsightRef.current;
          if (finalInsight) {
            const withInsight = { ...finalResponse, insight: finalInsight };
            setResponse(withInsight);
            responseRef.current = withInsight;
          }
        }

        setLoading(false);
        setLoadingStep("");

        // Add assistant turn to conversation with SQL and result summary
        if (responseRef.current) {
          const sqls = responseRef.current.queries
            .map((q) => q.sql)
            .filter(Boolean) as string[];
          const summary = buildResultSummary(responseRef.current.queries);

          updateLastAssistantTurn({
            content: responseRef.current.explanation || "",
            sql: sqls,
            resultSummary: summary,
          });

          // Ensure conversation exists — create on first prompt, reuse on follow-up
          let convId = useAppStore.getState().activeConversationId;
          if (!convId) {
            try {
              const convRes = await apiFetch("/api/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: prompt.slice(0, 80),
                  turns: useAppStore.getState().conversationTurns,
                }),
              });
              if (convRes.ok) {
                const convData = await convRes.json();
                convId = convData.conversation.id;
                setConversationId(convId!);
              }
            } catch (err) {
              console.error("Failed to create conversation:", err);
            }
          }

          // Save to chat history with conversationId
          const entry = {
            id: crypto.randomUUID(),
            prompt,
            response: responseRef.current,
            timestamp: Date.now(),
            conversationId: convId ?? undefined,
          };

          try {
            const res = await apiFetch("/api/chat-history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt,
                response: entry.response,
                conversationId: convId,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              entry.id = data.id;
            }
          } catch (err) {
            console.error("Failed to save to database:", err);
          }

          addChatEntry(entry);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setLoading(false);
          setLoadingStep("");
          return;
        }
        const message =
          err instanceof Error ? err.message : "Terjadi kesalahan";
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

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    executeAbortRef.current?.abort();
    sessionRef.current += 1; // Invalidate any pending async ops
    setResponse(null);
    setStreamingInsight("");
    setStreamingSQL("");
    setSelectedTables([]);
    setError(null);
    setLoading(false);
    setLoadingStep("");
    responseRef.current = null;
    clearConversation();
  }, [clearConversation]);

  const loadConversation = useCallback(
    (entries: ChatHistoryEntry[], conversationId?: string) => {
      // Abort any pending operations & invalidate their session
      abortControllerRef.current?.abort();
      executeAbortRef.current?.abort();
      sessionRef.current += 1; // All pending async ops will see a mismatched session and bail

      // Reset all state refs
      streamingInsightRef.current = "";
      fallbackInsightRef.current = null;
      responseRef.current = null;

      // Reset all React state
      setLoading(false);
      setLoadingStep("");
      setError(null);
      setStreamingSQL("");
      setSelectedTables([]);
      setStreamingInsight("");

      if (!entries || entries.length === 0) {
        setResponse(null);
        useAppStore.getState().setActiveConversation(null, []);
        setHistoryKey((k) => k + 1);
        return;
      }

      // Sort entries by timestamp ascending (oldest first)
      const sortedEntries = [...entries].sort(
        (a, b) => a.timestamp - b.timestamp,
      );

      // Rekonstruksi SEMUA turns dari seluruh entries
      // Setiap entry = 1 user turn + 1 assistant turn
      const turns: ConversationTurn[] = [];
      for (const entry of sortedEntries) {
        // User turn
        turns.push({
          id: crypto.randomUUID(),
          role: "user",
          content: entry.prompt,
          timestamp: entry.timestamp - 1,
        });

        // Assistant turn
        if (entry.response) {
          const sqls = entry.response.queries
            ?.map((q) => q.sql)
            .filter(Boolean) as string[];
          const summary = buildResultSummary(entry.response.queries || []);
          turns.push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: entry.response.explanation || "",
            sql: sqls,
            resultSummary: summary,
            timestamp: entry.timestamp,
          });
        }
      }

      // Tampilkan response dari entry TERAKHIR (yang paling baru dalam slice)
      const lastEntry = sortedEntries[sortedEntries.length - 1];
      const freshResponse = lastEntry.response
        ? {
            ...lastEntry.response,
            queries: [...(lastEntry.response.queries ?? [])],
          }
        : null;

      // Set response BEFORE Zustand update to avoid useSyncExternalStore
      // triggering a render with old response
      responseRef.current = freshResponse;
      setResponse(freshResponse);
      setStreamingInsight(freshResponse?.insight ?? "");
      setHistoryKey((k) => k + 1);

      // Update Zustand conversation state after React state
      useAppStore
        .getState()
        .setActiveConversation(conversationId || null, turns);
    },
    [],
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
