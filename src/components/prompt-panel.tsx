"use client";

import { useState } from "react";
import {
  Cpu,
  Send,
  Loader2,
  Plus,
  MessageSquare,
  ChevronDown,
  User,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ConversationTurn } from "@/types";

const EXAMPLE_PROMPTS = [
  "Tampilkan 10 kendaraan dengan pajak tertinggi",
  "Total pendapatan pajak bulan ini per kabupaten",
  "Daftar kendaraan dengan pajak jatuh tempo",
  "Cari kendaraan dengan nomor polisi DA",
  "Ranking kasir dengan transaksi terbanyak",
  "Distribusi kendaraan berdasarkan warna plat",
];

interface PromptPanelProps {
  loading: boolean;
  onSubmit: (prompt: string) => void;
  hasConversation?: boolean;
  onNewConversation?: () => void;
  conversationTurns?: ConversationTurn[];
}

export function PromptPanel({
  loading,
  onSubmit,
  hasConversation = false,
  onNewConversation,
  conversationTurns = [],
}: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSubmit(prompt);
    setPrompt("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  const handleNew = () => {
    setPrompt("");
    onNewConversation?.();
  };

  const userTurns = conversationTurns.filter((t) => t.role === "user");

  return (
    <div className="h-full flex flex-col border-r bg-background">
      {/* Panel Header */}
      <div className="h-10 border-b px-4 flex items-center gap-2 shrink-0">
        <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Prompt
        </span>
        {hasConversation && (
          <>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <MessageSquare className="w-3 h-3" />
              {userTurns.length} prompt
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNew}
              className="h-6 gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1.5"
            >
              <Plus className="w-3 h-3" />
              Baru
            </Button>
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
          {/* Conversation Turns — tampilkan semua Q&A */}
          {conversationTurns.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Riwayat Percakapan
                </span>
                <span className="text-[9px] text-muted-foreground/50 ml-auto">
                  {userTurns.length} pertanyaan
                </span>
              </div>
              <div className="space-y-2 pl-1 border-l-2 border-muted max-h-64 overflow-y-auto pr-1">
                {conversationTurns.map((turn) => (
                  <div
                    key={turn.id}
                    className="flex items-start gap-2"
                  >
                    {/* Avatar icon */}
                    <div
                      className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                        turn.role === "user"
                          ? "bg-primary/15 border border-primary/30"
                          : "bg-amber-500/15 border border-amber-500/30"
                      }`}
                    >
                      {turn.role === "user" ? (
                        <User className="w-2.5 h-2.5 text-primary" />
                      ) : (
                        <Bot className="w-2.5 h-2.5 text-amber-500" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs leading-relaxed border ${
                        turn.role === "user"
                          ? "bg-primary/5 border-primary/20 text-foreground/85"
                          : "bg-amber-500/5 border-amber-500/20 text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`block text-[9px] font-semibold uppercase tracking-wider mb-0.5 ${
                          turn.role === "user"
                            ? "text-primary/60"
                            : "text-amber-500/70"
                        }`}
                      >
                        {turn.role === "user" ? "Kamu" : "AI"}
                      </span>
                      <span className="line-clamp-3">{turn.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Textarea */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pertanyaan
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasConversation
                  ? "Tanya follow-up atau masukkan pertanyaan baru..."
                  : "Contoh: Tampilkan total pajak kendaraan bulan ini per kabupaten..."
              }
              rows={6}
              className="resize-none text-sm leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              Tekan{" "}
              <kbd className="bg-muted px-1 py-0.5 rounded text-[10px]">
                ⌘ Enter
              </kbd>{" "}
              untuk submit
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Menganalisa...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Generate Query
              </>
            )}
          </Button>

          {/* Example Prompts */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Contoh Pertanyaan
            </label>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  disabled={loading}
                  className="text-xs px-2.5 py-1.5 rounded-md border bg-muted/40 hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:pointer-events-none text-left"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </form>
      </ScrollArea>
    </div>
  );
}
