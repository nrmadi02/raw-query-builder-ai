import { useState, useEffect } from "react";
import {
  Loader2,
  Check,
  Circle,
  Database,
  Sparkles,
  Search,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Ordered list of pipeline steps shown during AI query processing.
 * The `key` values correspond to the `step` field sent in SSE "step" events
 * by the stream route. The labels and icons are purely for display.
 */
const STEPS = [
  { key: "validating",       label: "Memvalidasi pertanyaan", icon: Search       },
  { key: "selecting_tables", label: "Memilih tabel relevan",  icon: Database     },
  { key: "generating_sql",   label: "Membuat query SQL",      icon: Sparkles     },
  { key: "executing",        label: "Mengeksekusi query",     icon: Database     },
  { key: "analyzing",        label: "Menganalisis data",      icon: MessageSquare },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a `loadingStep` string (from the `useStreamChat` hook) to the index
 * of the currently active step in the STEPS array.
 *
 * This relies on Indonesian keyword matching because `loadingStep` values are
 * human-readable strings set in `use-stream-chat.ts` (e.g. "Memvalidasi pertanyaan...").
 * Returns -1 if no step is active.
 */
function getActiveStepIndex(step: string): number {
  if (step.includes("validasi") || step.includes("hubungkan")) return 0;
  if (step.includes("tabel")   || step.includes("memilih"))   return 1;
  if (step.includes("membuat") || step.includes("query") || step.includes("SQL")) return 2;
  if (step.includes("eksekusi"))                               return 3;
  if (step.includes("analisis") || step.includes("analisa"))   return 4;
  return -1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LoadingStateProps {
  modelLabel: string;
  step?: string;
  selectedTables?: string[];
  streamingSQL?: string;
}

export function LoadingState({
  modelLabel,
  step,
  selectedTables,
  streamingSQL,
}: LoadingStateProps) {
  const activeIndex = step ? getActiveStepIndex(step) : -1;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-1">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                Memproses permintaan
              </h3>
              <p className="text-[11px] text-muted-foreground">{modelLabel}</p>
            </div>
          </div>

          <div className="space-y-0">
            {STEPS.map((stepItem, i) => {
              const isCompleted = activeIndex > i;
              const isActive = activeIndex === i;
              const isPending = activeIndex < i;

              const showTableBadges =
                isActive &&
                stepItem.key === "selecting_tables" &&
                selectedTables &&
                selectedTables.length > 0;

              return (
                <div key={stepItem.key} className="flex gap-3">
                  {/* Step indicator circle + vertical connector */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors duration-300",
                        isCompleted && "bg-primary border-primary text-primary-foreground",
                        isActive    && "bg-primary/10 border-primary text-primary",
                        isPending   && "bg-muted border-muted-foreground/20 text-muted-foreground/40",
                      )}
                    >
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : isActive ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Circle className="w-3 h-3" />
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className={cn(
                          "w-0.5 min-h-[20px] flex-1 transition-colors duration-500",
                          isCompleted ? "bg-primary" : "bg-muted-foreground/15",
                        )}
                      />
                    )}
                  </div>

                  {/* Step label + optional extras */}
                  <div className={cn("pb-4", i === STEPS.length - 1 && "pb-0")}>
                    <p
                      className={cn(
                        "text-[13px] leading-tight pt-1 transition-colors duration-300",
                        isCompleted && "text-muted-foreground line-through decoration-muted-foreground/30",
                        isActive    && "text-foreground font-medium",
                        isPending   && "text-muted-foreground/50",
                      )}
                    >
                      {stepItem.label}
                    </p>

                    {/* Table badges shown while the table-selection step is active */}
                    {showTableBadges && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {selectedTables!.map((table) => (
                          <span
                            key={table}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono"
                          >
                            {table}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Streaming SQL preview shown while generating */}
                    {isActive && stepItem.key === "generating_sql" && streamingSQL && (
                      <pre className="mt-2 text-[11px] font-mono text-muted-foreground bg-muted/60 rounded-md p-2 max-h-36 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed w-full">
                        {streamingSQL}
                        <span className="animate-pulse text-primary">|</span>
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
