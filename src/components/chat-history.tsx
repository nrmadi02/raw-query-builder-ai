"use client";

import { useState } from "react";
import { MessageSquare, Trash2, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore, type ChatHistoryEntry } from "@/store/app-store";
import { useChatHistory } from "@/hooks/use-chat-history";

interface ChatHistoryProps {
  // allEntries: seluruh entries dalam conversation (untuk rekonstruksi full context)
  onSelect: (entries: ChatHistoryEntry[], conversationId?: string) => void;
}

interface ConversationGroup {
  conversationId: string;
  entries: ChatHistoryEntry[];
  title: string;
  updatedAt: number;
}

export function ChatHistory({ onSelect }: ChatHistoryProps) {
  const chatHistory = useAppStore((s) => s.chatHistory);
  const removeChatEntry = useAppStore((s) => s.removeChatEntry);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const { deleteFromDatabase, refetch } = useChatHistory();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
    });
  };

  const handleDelete = async (id: string) => {
    const success = await deleteFromDatabase(id);
    if (success) {
      removeChatEntry(id);
    }
  };

  const handleClearAll = async () => {
    for (const entry of chatHistory) {
      await deleteFromDatabase(entry.id);
    }
    clearHistory();
  };

  const toggleExpand = (id: string) => {
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

  // Group entries: conversationId-based groups first, then standalone
  const groupedEntries = (() => {
    const convMap = new Map<string, ChatHistoryEntry[]>();
    const standalone: ChatHistoryEntry[] = [];

    for (const entry of chatHistory) {
      if (entry.conversationId) {
        const existing = convMap.get(entry.conversationId) || [];
        existing.push(entry);
        convMap.set(entry.conversationId, existing);
      } else {
        standalone.push(entry);
      }
    }

    const groups: ConversationGroup[] = [];
    for (const [id, entries] of convMap) {
      const sorted = [...entries].sort((a, b) => a.timestamp - b.timestamp);
      groups.push({
        conversationId: id,
        entries: sorted,
        title: sorted[0]?.prompt || "Percakapan",
        updatedAt: Math.max(...sorted.map((e) => e.timestamp)),
      });
    }

    // Sort groups by most recent entry
    groups.sort((a, b) => b.updatedAt - a.updatedAt);

    return { groups, standalone };
  })();

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
        <div className="flex items-center gap-2">
          {chatHistory.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Hapus Semua
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {/* Conversation groups */}
          {groupedEntries.groups.map((group) => {
            const isExpanded = expandedIds.has(group.conversationId);
            return (
              <div key={group.conversationId} className="rounded-md border border-transparent hover:border-muted/60 hover:bg-muted/20 transition-colors">
                {/* Group header — klik untuk load SELURUH conversation */}
                <div
                  className="flex items-start gap-1.5 p-2 cursor-pointer"
                  onClick={() => {
                    toggleExpand(group.conversationId);
                    // Load full conversation context
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
                        {formatTime(group.updatedAt)}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">
                        · {group.entries.length} prompt
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded: tampilkan semua prompt dalam conversation */}
                {isExpanded && (
                  <div className="pl-4 pb-1.5 space-y-0.5 border-l-2 border-muted/40 ml-3 mt-0.5 mb-1">
                    {group.entries.map((entry, idx) => (
                      <div
                        key={entry.id}
                        className="group flex items-start gap-1.5 p-1.5 rounded hover:bg-muted/60 cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Klik entry individual: load sampai prompt ini (slice entries up to idx)
                          onSelect(group.entries.slice(0, idx + 1), group.conversationId);
                        }}
                      >
                        <span className="text-[9px] text-muted-foreground/40 shrink-0 mt-0.5 w-3 text-right">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-foreground/80 truncate leading-relaxed">
                            {entry.prompt}
                          </p>
                        </div>
                        <button
                          type="button"
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

          {/* Standalone entries (no conversation) */}
          {groupedEntries.standalone.map((entry) => (
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
                    {formatTime(entry.timestamp)}
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
