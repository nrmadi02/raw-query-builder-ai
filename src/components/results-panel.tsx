"use client";

import { useMemo } from "react";
import { AlertCircle, Bot, Database, Lightbulb, Table, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { InsightCard } from "@/components/insight-card";
import { QueryBlock } from "@/components/query-block";
import type { AIResponse } from "@/types";

const MODEL_LABEL = "GLM 5 Turbo";

interface ResultsPanelProps {
  response: AIResponse | null;
  streamingInsight: string;
  streamingSQL: string;
  selectedTables: string[];
  loading: boolean;
  loadingStep: string;
  error: string | null;
  onReset?: () => void;
}

export function ResultsPanel({
  response,
  streamingInsight,
  streamingSQL,
  selectedTables,
  loading,
  loadingStep,
  error,
  onReset,
}: ResultsPanelProps) {
  const totalRows = useMemo(
    () =>
      response?.queries?.reduce((sum, q) => sum + (q.rows?.length ?? 0), 0) ??
      0,
    [response?.queries],
  );

  return (
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
              {MODEL_LABEL}
            </Badge>
            {response.queries?.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {response.queries.length} tabel · {totalRows} baris
              </Badge>
            )}
            {!loading && onReset && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        {/* Loading */}
        {loading && !response && (
          <LoadingState
            modelLabel={MODEL_LABEL}
            step={loadingStep}
            selectedTables={selectedTables}
            streamingSQL={streamingSQL}
          />
        )}

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

        {/* Response */}
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

            {/* AI Insight Card */}
            {response.queries && response.queries.length > 0 && (
              <>
                {streamingInsight || response.insight ? (
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
                        <div
                          className="h-full bg-amber-500 rounded-full animate-pulse"
                          style={{ width: "60%" }}
                        />
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
  );
}
