import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIResponse } from "@/types";

export interface ChatHistoryEntry {
  id: string;
  prompt: string;
  response: AIResponse | null;
  timestamp: number;
  createdAt?: Date; // Added for DB sync
}

interface AppState {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  chatHistory: ChatHistoryEntry[];
  addChatEntry: (entry: ChatHistoryEntry) => void;
  removeChatEntry: (id: string) => void;
  clearHistory: () => void;
  // New methods for DB sync
  setChatHistory: (entries: ChatHistoryEntry[]) => void;
  syncFromDatabase: (entries: ChatHistoryEntry[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedModel: "gemini/gemini-2.0-flash-exp",
      setSelectedModel: (model) => set({ selectedModel: model }),
      chatHistory: [],
      addChatEntry: (entry) =>
        set((state) => ({
          chatHistory: [entry, ...state.chatHistory],
        })),
      removeChatEntry: (id) =>
        set((state) => ({
          chatHistory: state.chatHistory.filter((e) => e.id !== id),
        })),
      clearHistory: () => set({ chatHistory: [] }),
      setChatHistory: (entries) => set({ chatHistory: entries }),
      syncFromDatabase: (entries) => {
        // Only sync if DB entries are newer than local ones
        const localEntries = get().chatHistory;
        const mergedEntries = [...entries];

        // Add local entries that don't exist in DB yet (not yet saved)
        for (const local of localEntries) {
          if (!mergedEntries.some((db) => db.id === local.id)) {
            mergedEntries.push(local);
          }
        }

        // Sort by timestamp descending
        mergedEntries.sort((a, b) => b.timestamp - a.timestamp);

        set({ chatHistory: mergedEntries });
      },
    }),
    {
      name: "ai-query-builder-store",
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        // chatHistory: state.chatHistory, // Remove from localStorage - use DB instead
      }),
    },
  ),
);
