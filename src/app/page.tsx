"use client";

import React, { useState, useRef } from "react";
import {
  Bot,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Code2,
  Table,
  Cpu,
  Key,
  ChevronDown,
  Lightbulb,
  BarChart2,
  Database,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================
interface Model {
  id: string;
  label: string;
  provider: string;
  badge: "FREE" | "PAID";
  envKey: string;
  note: string;
}

interface QueryResult {
  title: string;
  sql: string;
  columns: string[];
  chartType: string;
  rows: any[];
  queryError: string | null;
  validationError?: string;
}

interface AIResponse {
  explanation: string;
  insight: string | null;
  queries: QueryResult[];
}

// ============================================================
// Model Options
// ============================================================
const MODEL_OPTIONS: { group: string; models: Model[] }[] = [
  {
    group: "Free Tier",
    models: [
      {
        id: "gemini/gemini-2.0-flash-exp",
        label: "Gemini 2.0 Flash Exp",
        provider: "Google",
        badge: "FREE" as const,
        envKey: "GEMINI_API_KEY",
        note: "Terbaru, gratis via Google AI Studio",
      },
      {
        id: "gemini/gemini-1.5-flash-latest",
        label: "Gemini 1.5 Flash Latest",
        provider: "Google",
        badge: "FREE" as const,
        envKey: "GEMINI_API_KEY",
        note: "Stabil, gratis via Google AI Studio",
      },
      {
        id: "groq/llama-3.3-70b-versatile",
        label: "Llama 3.3 70B",
        provider: "Groq",
        badge: "FREE" as const,
        envKey: "GROQ_API_KEY",
        note: "Super cepat (LPU), gratis via Groq",
      },
      {
        id: "groq/llama-3.1-8b-instant",
        label: "Llama 3.1 8B Instant",
        provider: "Groq",
        badge: "FREE" as const,
        envKey: "GROQ_API_KEY",
        note: "Paling cepat, cocok query sederhana",
      },
    ],
  },
  {
    group: "Paid",
    models: [
      {
        id: "gpt-4o",
        label: "GPT-4o",
        provider: "OpenAI",
        badge: "PAID" as const,
        envKey: "OPENAI_API_KEY",
        note: "Paling akurat, tapi berbayar",
      },
      {
        id: "claude-3-5-sonnet-20240620",
        label: "Claude 3.5 Sonnet",
        provider: "Anthropic",
        badge: "PAID" as const,
        envKey: "ANTHROPIC_API_KEY",
        note: "Sangat andal untuk SQL kompleks",
      },
    ],
  },
];

const ALL_MODELS: Model[] = MODEL_OPTIONS.flatMap((g) => g.models);

// ============================================================
// Empty State
// ============================================================
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Bot className="w-8 h-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">Belum ada hasil</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          Tulis pertanyaan di sebelah kiri dan klik{" "}
          <span className="font-medium text-foreground">Generate Query</span>{" "}
          untuk melihat hasilnya di sini.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Loading State
// ============================================================
function LoadingState({ modelLabel, step }: { modelLabel: string; step?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">Sedang menganalisa...</h3>
        {step && (
          <p className="text-xs text-primary animate-pulse">
            {step}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Menggunakan{" "}
          <span className="font-medium text-foreground">{modelLabel}</span>
        </p>
      </div>
    </div>
  );
}

// ============================================================
// AI Insight Card
// ============================================================
function InsightCard({ insight, isStreaming = false }: { insight: string; isStreaming?: boolean }) {
  return (
    <div className="rounded-lg border border-amber-200/60 bg-linear-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800/40 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
          <Lightbulb className={cn(
            "w-3.5 h-3.5 text-amber-600 dark:text-amber-400",
            isStreaming && "animate-pulse"
          )} />
        </div>
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
          Insight AI
        </span>
        {isStreaming && (
          <span className="text-[10px] text-amber-600 dark:text-amber-400 animate-pulse">
            menulis...
          </span>
        )}
      </div>
      <p className="text-sm text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
        {insight}
        {isStreaming && <span className="inline-block w-1 h-4 bg-amber-500 ml-0.5 animate-pulse" />}
      </p>
    </div>
  );
}

// ============================================================
// Single Query Block
// ============================================================
function QueryBlock({ query, index }: { query: QueryResult; index: number }) {
  const [sqlExpanded, setSqlExpanded] = useState(false);

  return (
    <div className="space-y-3 rounded-xl border bg-background overflow-hidden shadow-sm">
      {/* Query Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/30">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Database className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground font-medium">
            #{index + 1}
          </span>
          <span className="text-sm font-semibold text-foreground truncate">
            {query.title || `Query ${index + 1}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {query.chartType && (
            <Badge
              variant="secondary"
              className="text-[10px] gap-1 px-1.5 py-0"
            >
              <BarChart2 className="w-2.5 h-2.5" />
              {query.chartType}
            </Badge>
          )}
          {query.rows && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {query.rows.length} baris
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* SQL Toggle */}
        <div className="rounded-lg border overflow-hidden">
          <button
            type="button"
            onClick={() => setSqlExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-950/90 text-left hover:bg-zinc-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                SQL Query
              </span>
            </div>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-zinc-500 transition-transform",
                sqlExpanded && "rotate-180",
              )}
            />
          </button>
          {sqlExpanded && (
            <div className="bg-zinc-950 px-4 pb-4 pt-2 overflow-x-auto border-t border-zinc-800">
              <pre className="text-zinc-100 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                {query.sql}
              </pre>
            </div>
          )}
        </div>

        {/* Columns metadata */}
        {query.columns?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Kolom:</span>
            <div className="flex flex-wrap gap-1">
              {query.columns.map((col) => (
                <code
                  key={col}
                  className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground/80"
                >
                  {col}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Validation Error (Context) */}
        {query.validationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800/40 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Pertanyaan Di Luar Konteks
              </p>
              <p className="text-sm text-red-600 dark:text-red-400/90 leading-relaxed">
                {query.validationError}
              </p>
            </div>
          </div>
        )}

        {/* Query Execution Error */}
        {query.queryError && !query.validationError && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800/40 p-3 flex gap-2.5">
            <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                Error Eksekusi
              </p>
              <code className="text-xs text-orange-600 dark:text-orange-400/80 break-all block">
                {query.queryError}
              </code>
            </div>
          </div>
        )}

        {/* Data Table */}
        {query.rows && query.rows.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/20">
                  <tr>
                    {Object.keys(query.rows[0]).map((key) => (
                      <th
                        key={key}
                        className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.rows.map((row: any, i: number) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-b last:border-0 transition-colors hover:bg-muted/30",
                        i % 2 === 0 ? "bg-background" : "bg-muted/10",
                      )}
                    >
                      {Object.values(row).map((val: any, j: number) => (
                        <td
                          key={j}
                          className="px-4 py-2.5 text-sm whitespace-nowrap text-foreground"
                        >
                          {val !== null && val !== undefined ? (
                            String(val)
                          ) : (
                            <span className="text-muted-foreground italic text-xs">
                              null
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty result */}
        {query.rows && query.rows.length === 0 && !query.queryError && (
          <div className="rounded-lg border bg-muted/20 p-3 flex gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Query berhasil dieksekusi, namun tidak ada data{" "}
              <span className="font-medium">(0 rows)</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================
export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(
    "gemini/gemini-2.0-flash-exp",
  );
  const [response, setResponse] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingInsight, setStreamingInsight] = useState("");
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const streamingInsightRef = useRef("");

  const activeModel = ALL_MODELS.find((m) => m.id === selectedModel)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setStreamingInsight("");
    setLoadingStep("Menghubungkan ke AI...");
    streamingInsightRef.current = "";

    try {
      setLoadingStep("Memvalidasi pertanyaan...");
      
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || "Terjadi kesalahan dari sisi server");
        }
        throw new Error(await res.text() || "Terjadi kesalahan dari sisi server");
      }

      setLoadingStep("Membaca response...");
      
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let insightText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[UI] Stream done");
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        console.log("[UI] Received chunk:", chunk.slice(0, 200));

        // Parse SSE events
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;

          const lines = part.split("\n");
          let eventType = "";
          let dataStr = "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataStr = line.slice(5).trim();
            }
          }

          console.log("[UI] Event:", eventType, "Data:", dataStr?.slice(0, 100));

          if (!eventType || !dataStr) continue;

          // Handle different event types
          if (eventType === "metadata") {
            setLoadingStep("Memproses hasil query...");
            try {
              const data = JSON.parse(dataStr);
              setResponse({
                explanation: data.explanation,
                insight: null,
                queries: data.queries,
              });
            } catch (e) {
              console.error("[UI] Failed to parse metadata:", e);
            }
          } else if (eventType === "insight") {
            setLoadingStep("Menganalisis data...");
            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                insightText += data.content;
                streamingInsightRef.current = insightText;
                setStreamingInsight(insightText);
              }
            } catch (e) {
              console.error("[UI] Failed to parse insight:", e);
            }
          } else if (eventType === "done") {
            console.log("[UI] Done event received");
            if (insightText) {
              setResponse((prev) =>
                prev ? { ...prev, insight: insightText } : null
              );
            }
          }
        }
      }

      // Final state update
      setLoading(false);
      setLoadingStep("");
      if (insightText) {
        setResponse((prev) =>
          prev ? { ...prev, insight: insightText } : null
        );
      }
    } catch (err: any) {
      console.error("[UI] Submit error:", err);
      setError(err.message);
      setLoading(false);
      setLoadingStep("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const totalRows =
    response?.queries?.reduce((sum, q) => sum + (q.rows?.length ?? 0), 0) ?? 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b flex items-center px-4 gap-3 shrink-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">AI Query Builder</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">
          Natural Language → SQL → Data
        </span>
      </header>

      {/* Main Resizable Layout */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          {/* ── LEFT PANEL: Prompt ── */}
          <ResizablePanel defaultSize="45%" minSize="30%" maxSize="65%">
            <div className="h-full flex flex-col border-r bg-background">
              {/* Panel Header */}
              <div className="h-10 border-b px-4 flex items-center gap-2 shrink-0">
                <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Prompt
                </span>
              </div>

              <ScrollArea className="flex-1">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-5 p-4"
                >
                  {/* Model Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Model AI
                    </label>

                    {/* Selected model display */}
                    <button
                      type="button"
                      onClick={() => setModelSelectorOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">
                          {activeModel.label}
                        </span>
                        <Badge
                          variant={
                            activeModel.badge === "FREE" ? "success" : "warning"
                          }
                          className="shrink-0 text-[10px] px-1.5 py-0"
                        >
                          {activeModel.badge}
                        </Badge>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
                          modelSelectorOpen && "rotate-180",
                        )}
                      />
                    </button>

                    {/* Dropdown model list */}
                    {modelSelectorOpen && (
                      <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                        {MODEL_OPTIONS.map((group) => (
                          <div key={group.group}>
                            <div className="px-3 py-1.5 bg-muted/50 border-b">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {group.group}
                              </span>
                            </div>
                            {group.models.map((model, i) => (
                              <button
                                key={model.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModel(model.id);
                                  setModelSelectorOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2.5 text-sm transition-colors flex items-start justify-between gap-2",
                                  i < group.models.length - 1 && "border-b",
                                  selectedModel === model.id
                                    ? "bg-primary/5 text-primary"
                                    : "hover:bg-muted/50 text-foreground",
                                )}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {model.label}
                                    </span>
                                  </div>
                                  <span className="text-xs text-muted-foreground">
                                    {model.provider} · {model.note}
                                  </span>
                                </div>
                                <Badge
                                  variant={
                                    model.badge === "FREE"
                                      ? "success"
                                      : "warning"
                                  }
                                  className="shrink-0 text-[10px] px-1.5 py-0 mt-0.5"
                                >
                                  {model.badge}
                                </Badge>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* API key hint */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Key className="w-3 h-3" />
                      <span>
                        Butuh env:{" "}
                        <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                          {activeModel.envKey}
                        </code>
                      </span>
                    </div>
                  </div>

                  {/* Prompt Textarea */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Pertanyaan
                    </label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Contoh: Berapa total penjualan per pengguna bulan ini?"
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
                </form>
              </ScrollArea>
            </div>
          </ResizablePanel>

          {/* ── RESIZE HANDLE ── */}
          <ResizableHandle withHandle />

          {/* ── RIGHT PANEL: Result ── */}
          <ResizablePanel defaultSize="55%" minSize="35%">
            <div className="h-full flex flex-col bg-background">
              {/* Panel Header */}
              <div className="h-10 border-b px-4 flex items-center gap-2 shrink-0">
                <Table className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Hasil
                </span>
                {response && (
                  <>
                    <div className="flex-1" />
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                      {activeModel.label}
                    </Badge>
                    {response.queries?.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {response.queries.length} tabel · {totalRows} baris
                      </Badge>
                    )}
                  </>
                )}
              </div>

              <ScrollArea className="flex-1">
                {/* Loading - hanya tampilkan sebelum ada response */}
                {loading && !response && <LoadingState modelLabel={activeModel.label} step={loadingStep} />}

                {/* Error */}
                {!loading && error && (
                  <div className="p-4">
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
                      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-destructive">
                          Terjadi Kesalahan
                        </p>
                        <p className="text-xs text-muted-foreground wrap-break-word">
                          {error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty */}
                {!loading && !error && !response && <EmptyState />}

                {/* Response - tampilkan ketika ada data (baik loading maupun selesai) */}
                {response && (
                  <div className="p-4 space-y-4">
                    {/* AI Explanation */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Penjelasan AI
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {response.explanation}
                      </p>
                    </div>

                    {/* AI Insight Card - selalu tampilkan jika ada query */}
                    {response.queries && response.queries.length > 0 && (
                      <>
                        {(streamingInsight || response.insight) ? (
                          <InsightCard 
                            insight={streamingInsight || response.insight || ""} 
                            isStreaming={loading && !!streamingInsight}
                          />
                        ) : loading ? (
                          <div className="rounded-lg border border-amber-200/60 bg-linear-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800/40 p-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse" />
                              </div>
                              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                Menganalisis Data...
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-amber-200/50 dark:bg-amber-800/30 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                              </div>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                {loadingStep || "Memproses..."}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}

                    {/* Multi-Query Results */}
                    {response.queries && response.queries.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Hasil Query
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {response.queries.length} tabel
                          </Badge>
                        </div>
                        {response.queries.map((query, index) => (
                          <QueryBlock key={index} query={query} index={index} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
