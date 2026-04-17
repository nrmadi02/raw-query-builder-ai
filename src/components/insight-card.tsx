import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export function InsightCard({
  insight,
  isStreaming = false,
}: {
  insight: string;
  isStreaming?: boolean;
}) {
  return (
    <div className="rounded-lg border border-amber-200/60 bg-linear-to-br from-amber-50/80 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:border-amber-800/40 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-amber-500/15 flex items-center justify-center">
          <Lightbulb
            className={cn(
              "w-3.5 h-3.5 text-amber-600 dark:text-amber-400",
              isStreaming && "animate-pulse",
            )}
          />
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
      <div className="max-h-40 overflow-y-auto">
        <p className="text-sm text-amber-900/80 dark:text-amber-100/80 leading-relaxed">
          {insight}
          {isStreaming && (
            <span className="inline-block w-1 h-4 bg-amber-500 ml-0.5 animate-pulse" />
          )}
        </p>
      </div>
    </div>
  );
}
