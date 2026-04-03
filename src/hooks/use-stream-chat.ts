"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { AIResponse, Message, QueryResult } from "@/types";
import { useAppStore } from "@/store/app-store";

export function useStreamChat() {
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [streamingInsight, setStreamingInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const streamingInsightRef = useRef("");
  const fallbackInsightRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const responseRef = useRef<AIResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const executeAbortRef = useRef<AbortController | null>(null);

  const addChatEntry = useAppStore((s) => s.addChatEntry);

  // Cleanup on unmount
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
    async (queries: QueryResult[], signal: AbortSignal) => {
      setLoadingStep("Mengeksekusi query...");

      // Mark all queries as executing
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

      // Update response with all results
      setResponse((prev) => {
        if (!prev) return null;
        const updatedQueries = prev.queries.map((q, i) => {
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
        return { ...prev, queries: updatedQueries };
      });

      // Also update the ref
      if (responseRef.current) {
        const updatedQueries = responseRef.current.queries.map((q, i) => {
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
        responseRef.current = {
          ...responseRef.current,
          queries: updatedQueries,
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
      model: string,
      signal: AbortSignal,
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
            model,
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
              if (line.startsWith("data: ")) dataStr = line.slice(6);
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
    async (prompt: string, model: string) => {
      // Cancel previous request
      abortControllerRef.current?.abort();
      executeAbortRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Separate abort controller for execute + insight phase
      const executeAbort = new AbortController();
      executeAbortRef.current = executeAbort;

      setLoading(true);
      setError(null);
      setResponse(null);
      setStreamingInsight("");
      setLoadingStep("Menghubungkan ke AI...");
      streamingInsightRef.current = "";

      const userMessage: Message = { role: "user", content: prompt };
      messagesRef.current = [...messagesRef.current, userMessage];

      try {
        setLoadingStep("Memvalidasi pertanyaan...");

        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: messagesRef.current,
            model,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
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

        setLoadingStep("Membuat query SQL...");

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

            if (eventType === "metadata") {
              try {
                const data = JSON.parse(dataStr);
                const newResponse: AIResponse = {
                  explanation: data.explanation,
                  insight: null,
                  queries: data.queries,
                };
                setResponse(newResponse);
                responseRef.current = newResponse;
                fallbackInsightRef.current = data.fallbackInsight || null;
              } catch {
                // Skip invalid JSON
              }
            } else if (eventType === "done") {
              // Stream complete, now execute queries
            }
          }
        }

        // Check if aborted during stream
        if (abortController.signal.aborted) return;

        // Phase 2: Execute queries in parallel
        const currentResponse = responseRef.current;
        if (
          currentResponse &&
          currentResponse.queries.length > 0 &&
          !currentResponse.queries.some((q) => q.validationError)
        ) {
          await executeQueries(currentResponse.queries, executeAbort.signal);
        }

        // Check if aborted during execution
        if (executeAbort.signal.aborted) return;

        // Phase 3: Generate insight with real data
        const finalResponse = responseRef.current;
        if (finalResponse) {
          const insight = await generateInsight(
            prompt,
            finalResponse.queries,
            model,
            executeAbort.signal,
          );

          const finalInsight = insight || fallbackInsightRef.current;
          if (finalInsight) {
            const withInsight = { ...finalResponse, insight: finalInsight };
            setResponse(withInsight);
            responseRef.current = withInsight;
          }
        }

        setLoading(false);
        setLoadingStep("");

        // Save to chat history after everything is done
        if (responseRef.current) {
          const entry = {
            id: crypto.randomUUID(),
            prompt,
            response: responseRef.current,
            timestamp: Date.now(),
          };

          // Save to database first
          try {
            const res = await fetch("/api/chat-history", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt,
                response: entry.response,
              }),
            });
            if (res.ok) {
              const data = await res.json();
              // Use the ID from database if available
              entry.id = data.id;
            }
          } catch (err) {
            console.error("Failed to save to database:", err);
            // Continue with local save even if DB fails
          }

          // Then add to local store
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
        messagesRef.current = messagesRef.current.slice(0, -1);
      }
    },
    [addChatEntry, executeQueries, generateInsight],
  );

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    executeAbortRef.current?.abort();
    setResponse(null);
    setStreamingInsight("");
    setError(null);
    setLoading(false);
    setLoadingStep("");
    messagesRef.current = [];
    responseRef.current = null;
  }, []);

  const loadConversation = useCallback(
    (prompt: string, savedResponse: AIResponse) => {
      messagesRef.current = [{ role: "user", content: prompt }];
      responseRef.current = savedResponse;
      setResponse(savedResponse);
      setStreamingInsight(savedResponse.insight || "");
      setError(null);
    },
    [],
  );

  return {
    response,
    streamingInsight,
    loading,
    loadingStep,
    error,
    submit,
    cancel,
    reset,
    loadConversation,
  };
}
