"use client";

import { useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { useApiFetch } from "@/hooks/use-api-fetch";

export function useChatHistory() {
  const { syncFromDatabase, chatHistory } = useAppStore();
  const apiFetch = useApiFetch();

  const loadFromDatabase = useCallback(async () => {
    try {
      const res = await apiFetch("/api/chat-history");
      if (res.status === 401) return; // Will be redirected by useApiFetch
      if (res.ok) {
        const data = await res.json();
        const entries = data.map((item: any) => ({
          id: item.id,
          prompt: item.prompt,
          response: item.response,
          timestamp: new Date(item.createdAt).getTime(),
          createdAt: new Date(item.createdAt),
          conversationId: item.conversationId || undefined,
        }));
        syncFromDatabase(entries);
      }
    } catch (error) {
      console.error("Failed to load chat history from database:", error);
    }
  }, [syncFromDatabase, apiFetch]);

  useEffect(() => {
    if (chatHistory.length === 0) {
      loadFromDatabase();
    }
  }, [loadFromDatabase, chatHistory.length]);

  const deleteFromDatabase = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/api/chat-history/${id}`, { method: "DELETE" });
      return res.ok;
    } catch (error) {
      console.error("Failed to delete chat history:", error);
      return false;
    }
  }, [apiFetch]);

  const refetch = useCallback(() => {
    loadFromDatabase();
  }, [loadFromDatabase]);

  return {
    loadFromDatabase,
    deleteFromDatabase,
    refetch,
  };
}
