import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIResponse } from "@/types";

export interface ChatHistoryEntry {
  id: string;
  prompt: string;
  response: AIResponse | null;
  timestamp: number;
}

interface AppState {
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  chatHistory: ChatHistoryEntry[];
  addChatEntry: (entry: ChatHistoryEntry) => void;
  removeChatEntry: (id: string) => void;
  clearHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: "ai-query-builder-store",
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        chatHistory: state.chatHistory,
      }),
    },
  ),
);
