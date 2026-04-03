"use client";

import { MessageSquare, Trash2, Clock } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore, type ChatHistoryEntry } from "@/store/app-store";
import { useChatHistory } from "@/hooks/use-chat-history";
import { cn } from "@/lib/utils";

interface ChatHistoryProps {
  onSelect: (prompt: string, response: ChatHistoryEntry["response"]) => void;
}

export function ChatHistory({ onSelect }: ChatHistoryProps) {
  const chatHistory = useAppStore((s) => s.chatHistory);
  const removeChatEntry = useAppStore((s) => s.removeChatEntry);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const { deleteFromDatabase, refetch } = useChatHistory();

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
    // Delete from database
    const success = await deleteFromDatabase(id);
    if (success) {
      // Remove from local store
      removeChatEntry(id);
    }
  };

  const handleClearAll = async () => {
    // Delete all entries from database
    for (const entry of chatHistory) {
      await deleteFromDatabase(entry.id);
    }
    // Clear local store
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
          {chatHistory.map((entry) => (
            <div
              key={entry.id}
              className="group flex items-start gap-1.5 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => {
                if (entry.response) {
                  onSelect(entry.prompt, entry.response);
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
