"use client";

import { useState, useMemo } from "react";
import { MessageSquare, Trash2, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore, type ChatHistoryEntry } from "@/store/app-store";
import { useChatHistory } from "@/hooks/use-chat-history";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatHistoryProps {
  /** Called when the user selects a conversation or individual entry from history. */
  onSelect: (entries: ChatHistoryEntry[], conversationId?: string) => void;
}

interface ConversationGroup {
  conversationId: string;
  entries: ChatHistoryEntry[];
  /** Title derived from the first prompt in the conversation. */
  title: string;
  /** Timestamp of the most recent entry, used for sorting. */
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Formats a Unix timestamp as a short, human-readable string.
 * - Same day: shows HH:MM (e.g. "14:30")
 * - Different day: shows day + abbreviated month (e.g. "17 Apr")
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
}

/**
 * Groups chat history entries by their `conversationId`.
 * Entries without a conversationId are returned as standalone items.
 */
function groupEntriesByConversation(entries: ChatHistoryEntry[]): {
  groups: ConversationGroup[];
  standalone: ChatHistoryEntry[];
} {
  const convMap = new Map<string, ChatHistoryEntry[]>();
  const standalone: ChatHistoryEntry[] = [];

  for (const entry of entries) {
    if (entry.conversationId) {
      const existing = convMap.get(entry.conversationId) ?? [];
      existing.push(entry);
      convMap.set(entry.conversationId, existing);
    } else {
      standalone.push(entry);
    }
  }

  const groups: ConversationGroup[] = [];
  for (const [id, groupEntries] of convMap) {
    const sorted = [...groupEntries].sort((a, b) => a.timestamp - b.timestamp);
    groups.push({
      conversationId: id,
      entries: sorted,
      title: sorted[0]?.prompt ?? "Percakapan",
      updatedAt: Math.max(...sorted.map((entry) => entry.timestamp)),
    });
  }

  // Sort groups with most recently updated first
  groups.sort((a, b) => b.updatedAt - a.updatedAt);

  return { groups, standalone };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatHistory({ onSelect }: ChatHistoryProps) {
  const chatHistory = useAppStore((state) => state.chatHistory);
  const removeChatEntry = useAppStore((state) => state.removeChatEntry);
  const clearHistory = useAppStore((state) => state.clearHistory);
  const { deleteFromDatabase } = useChatHistory();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { groups, standalone } = useMemo(
    () => groupEntriesByConversation(chatHistory),
    [chatHistory],
  );

  const toggleExpand = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDelete = async (id: string): Promise<void> => {
    const success = await deleteFromDatabase(id);
    if (success) removeChatEntry(id);
  };

  const handleClearAll = async (): Promise<void> => {
    for (const entry of chatHistory) {
      await deleteFromDatabase(entry.id);
    }
    clearHistory();
  };

  if (chatHistory.length === 0) {
    return (
      <div className="p-3 text-center">
        <MessageSquare className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground/60">Belum ada riwayat</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Riwayat
        </span>
        {chatHistory.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Hapus semua riwayat"
          >
            Hapus Semua
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {/* Grouped conversations */}
          {groups.map((group) => {
            const isExpanded = expandedIds.has(group.conversationId);
            return (
              <div
                key={group.conversationId}
                className="rounded-md border border-transparent hover:border-muted/60 hover:bg-muted/20 transition-colors"
              >
                {/* Group header — clicking loads the full conversation */}
                <div
                  className="flex items-start gap-1.5 p-2 cursor-pointer"
                  onClick={() => {
                    toggleExpand(group.conversationId);
                    onSelect(group.entries, group.conversationId);
                  }}
                >
                  <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate leading-relaxed font-medium">
                      {group.title}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 text-muted-foreground/40" />
                      <span className="text-[10px] text-muted-foreground/50">
                        {formatTimestamp(group.updatedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        · {group.entries.length} prompt
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded: show all prompts in this conversation */}
                {isExpanded && (
                  <div className="pl-4 pb-1.5 space-y-0.5 border-l-2 border-muted/40 ml-3 mt-0.5 mb-1">
                    {group.entries.map((entry, index) => (
                      <div
                        key={entry.id}
                        className="group flex items-start gap-1.5 p-1.5 rounded hover:bg-muted/60 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Load conversation up to and including this entry
                          onSelect(group.entries.slice(0, index + 1), group.conversationId);
                        }}
                      >
                        <span className="text-[9px] text-muted-foreground/40 shrink-0 mt-0.5 w-3 text-right">
                          {index + 1}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground/80 truncate leading-relaxed">
                            {entry.prompt}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`Hapus prompt: ${entry.prompt}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(entry.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
                        >
                          <Trash2 className="w-2.5 h-2.5 text-muted-foreground/50 hover:text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone entries (no conversation group) */}
          {standalone.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-start gap-1.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => {
                if (entry.response) {
                  onSelect([entry], entry.conversationId);
                }
              }}
            >
              <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate leading-relaxed">
                  {entry.prompt}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5 text-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground/50">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  {entry.response?.queries && (
                    <span className="text-[10px] text-muted-foreground/50">
                      · {entry.response.queries.length} query
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label={`Hapus: ${entry.prompt}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(entry.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
              >
                <Trash2 className="w-3 h-3 text-muted-foreground/50 hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
