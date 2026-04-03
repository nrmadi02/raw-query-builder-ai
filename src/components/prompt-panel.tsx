"use client";

import { useState } from "react";
import { Cpu, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelSelector } from "@/components/model-selector";
import { useAppStore } from "@/store/app-store";

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
}

export function PromptPanel({ loading, onSubmit }: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSubmit(prompt);
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

  return (
    <div className="h-full flex flex-col border-r bg-background">
      {/* Panel Header */}
      <div className="h-10 border-b px-4 flex items-center gap-2 shrink-0">
        <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Prompt
        </span>
      </div>

      <ScrollArea className="flex-1">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-4">
          {/* Model Selector */}
          <ModelSelector
            selectedModel={selectedModel}
            onSelect={setSelectedModel}
            open={modelSelectorOpen}
            onToggle={() => setModelSelectorOpen((v) => !v)}
          />

          {/* Prompt Textarea */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pertanyaan
            </label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Contoh: Tampilkan total pajak kendaraan bulan ini per kabupaten..."
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
