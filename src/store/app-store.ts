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
  // --- Chat History ---
  chatHistory: ChatHistoryEntry[];
  addChatEntry: (entry: ChatHistoryEntry) => void;
  removeChatEntry: (id: string) => void;
  clearHistory: () => void;
  setChatHistory: (entries: ChatHistoryEntry[]) => void;
  /**
   * Merges database entries with local ones, deduplicating by ID,
   * then sorts all entries by timestamp descending.
   */
  syncFromDatabase: (entries: ChatHistoryEntry[]) => void;

  // --- Active Conversation ---
  activeConversationId: string | null;
  conversationTurns: ConversationTurn[];
  setActiveConversation: (id: string | null, turns: ConversationTurn[]) => void;
  addTurn: (turn: ConversationTurn) => void;
  updateLastAssistantTurn: (update: Partial<ConversationTurn>) => void;
  setConversationId: (id: string) => void;
  clearConversation: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // --- Chat History ---
      chatHistory: [],
      addChatEntry: (entry) =>
        set((state) => ({ chatHistory: [entry, ...state.chatHistory] })),
      removeChatEntry: (id) =>
        set((state) => ({
          chatHistory: state.chatHistory.filter((entry) => entry.id !== id),
        })),
      clearHistory: () => set({ chatHistory: [] }),
      setChatHistory: (entries) => set({ chatHistory: entries }),
      syncFromDatabase: (entries) => {
        const localEntries = get().chatHistory;
        const merged = [...entries];

        for (const local of localEntries) {
          if (!merged.some((db) => db.id === local.id)) {
            merged.push(local);
          }
        }

        merged.sort((a, b) => b.timestamp - a.timestamp);
        set({ chatHistory: merged });
      },

      // --- Active Conversation ---
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
          const reversedIndex = [...turns].reverse().findIndex((t) => t.role === "assistant");
          if (reversedIndex === -1) return state;
          const actualIndex = turns.length - 1 - reversedIndex;
          turns[actualIndex] = { ...turns[actualIndex], ...update };
          return { conversationTurns: turns };
        }),
      setConversationId: (id) => set({ activeConversationId: id }),
      clearConversation: () =>
        set({ activeConversationId: null, conversationTurns: [] }),
    }),
    {
      name: "ai-query-builder-store",
      // Conversation state is intentionally not persisted — it is always
      // reconstructed from the database when loading a conversation.
      partialize: () => ({}),
    },
  ),
);
