import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIResponse, ConversationTurn } from "@/types";

export interface ChatHistoryEntry {
  id: string;
  prompt: string;
  response: AIResponse | null;
  timestamp: number;
  createdAt?: Date;
  conversationId?: string;
}

interface AppState {
  chatHistory: ChatHistoryEntry[];
  addChatEntry: (entry: ChatHistoryEntry) => void;
  removeChatEntry: (id: string) => void;
  clearHistory: () => void;
  setChatHistory: (entries: ChatHistoryEntry[]) => void;
  syncFromDatabase: (entries: ChatHistoryEntry[]) => void;

  activeConversationId: string | null;
  conversationTurns: ConversationTurn[];
  setActiveConversation: (
    id: string | null,
    turns: ConversationTurn[],
  ) => void;
  addTurn: (turn: ConversationTurn) => void;
  updateLastAssistantTurn: (update: Partial<ConversationTurn>) => void;
  setConversationId: (id: string) => void;
  clearConversation: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
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
        const localEntries = get().chatHistory;
        const mergedEntries = [...entries];

        for (const local of localEntries) {
          if (!mergedEntries.some((db) => db.id === local.id)) {
            mergedEntries.push(local);
          }
        }

        mergedEntries.sort((a, b) => b.timestamp - a.timestamp);

        set({ chatHistory: mergedEntries });
      },

      activeConversationId: null,
      conversationTurns: [],
      setActiveConversation: (id, turns) =>
        set({ activeConversationId: id, conversationTurns: turns }),
      addTurn: (turn) =>
        set((state) => ({
          conversationTurns: [...state.conversationTurns, turn],
        })),
      updateLastAssistantTurn: (update) =>
        set((state) => {
          const turns = [...state.conversationTurns];
          const lastAssistantIdx = [...turns]
            .reverse()
            .findIndex((t) => t.role === "assistant");
          if (lastAssistantIdx === -1) return state;
          const actualIdx = turns.length - 1 - lastAssistantIdx;
          turns[actualIdx] = { ...turns[actualIdx], ...update };
          return { conversationTurns: turns };
        }),
      setConversationId: (id) =>
        set({ activeConversationId: id }),
      clearConversation: () =>
        set({
          activeConversationId: null,
          conversationTurns: [],
        }),
    }),
    {
      name: "ai-query-builder-store",
      partialize: (state) => ({}),
    },
  ),
);
