"use client";

import { useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app-store";

export function useChatHistory() {
  const { syncFromDatabase, chatHistory } = useAppStore();

  const loadFromDatabase = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-history");
      if (res.ok) {
        const data = await res.json();
        // Transform DB data to ChatHistoryEntry format
        const entries = data.map((item: any) => ({
          id: item.id,
          prompt: item.prompt,
          response: item.response,
          timestamp: new Date(item.createdAt).getTime(),
          createdAt: new Date(item.createdAt),
        }));
        syncFromDatabase(entries);
      }
    } catch (error) {
      console.error("Failed to load chat history from database:", error);
    }
  }, [syncFromDatabase]);

  // Load on mount if local history is empty
  useEffect(() => {
    if (chatHistory.length === 0) {
      loadFromDatabase();
    }
  }, [loadFromDatabase, chatHistory.length]);

  const deleteFromDatabase = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat-history/${id}`, {
        method: "DELETE",
      });
      return res.ok;
    } catch (error) {
      console.error("Failed to delete chat history:", error);
      return false;
    }
  }, []);

  const refetch = useCallback(() => {
    loadFromDatabase();
  }, [loadFromDatabase]);

  return {
    loadFromDatabase,
    deleteFromDatabase,
    refetch,
  };
}
