"use client";

import { useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { useApiFetch } from "@/hooks/use-api-fetch";
import type { ChatHistoryEntry } from "@/store/app-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of a chat history record returned by GET /api/chat-history.
 * Matches the Prisma `ChatHistory` model fields used by this hook.
 */
interface ChatHistoryApiItem {
  id: string;
  prompt: string;
  response: ChatHistoryEntry["response"];
  createdAt: string;
  conversationId: string | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatHistory() {
  const { syncFromDatabase, chatHistory } = useAppStore();
  const apiFetch = useApiFetch();

  /**
   * Fetches all chat history entries from the database and merges them
   * with any locally stored entries via the Zustand store.
   */
  const loadFromDatabase = useCallback(async (): Promise<void> => {
    try {
      const res = await apiFetch("/api/chat-history");
      // 401 is handled globally by useApiFetch (redirect to login)
      if (res.status === 401) return;

      if (res.ok) {
        const data = (await res.json()) as ChatHistoryApiItem[];
        const entries: ChatHistoryEntry[] = data.map((item) => ({
          id: item.id,
          prompt: item.prompt,
          response: item.response,
          timestamp: new Date(item.createdAt).getTime(),
          createdAt: new Date(item.createdAt),
          conversationId: item.conversationId ?? undefined,
        }));
        syncFromDatabase(entries);
      }
    } catch (error) {
      console.error("Failed to load chat history from database:", error);
    }
  }, [syncFromDatabase, apiFetch]);

  // Load from DB on mount if the local store is empty
  useEffect(() => {
    if (chatHistory.length === 0) {
      loadFromDatabase();
    }
  }, [loadFromDatabase, chatHistory.length]);

  /** Deletes a single chat history entry from the database by its ID. */
  const deleteFromDatabase = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`/api/chat-history/${id}`, { method: "DELETE" });
      return res.ok;
    } catch (error) {
      console.error("Failed to delete chat history:", error);
      return false;
    }
  }, [apiFetch]);

  /** Manually triggers a reload of chat history from the database. */
  const refetch = useCallback((): void => {
    loadFromDatabase();
  }, [loadFromDatabase]);

  return {
    loadFromDatabase,
    deleteFromDatabase,
    refetch,
  };
}
