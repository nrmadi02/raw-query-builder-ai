"use client";

import { ChevronDown, Key } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MODEL_OPTIONS } from "@/config/models";
import type { Model } from "@/types";

interface ModelSelectorProps {
  selectedModel: string;
  onSelect: (modelId: string) => void;
  open: boolean;
  onToggle: () => void;
}

export function ModelSelector({
  selectedModel,
  onSelect,
  open,
  onToggle,
}: ModelSelectorProps) {
  const activeModel = findModel(selectedModel);

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Model AI
      </label>

      {/* Selected model display */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border bg-muted/40 hover:bg-muted/60 transition-colors text-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{activeModel.label}</span>
          <Badge
            variant={activeModel.badge === "FREE" ? "success" : "warning"}
            className="shrink-0 text-[10px] px-1.5 py-0"
          >
            {activeModel.badge}
          </Badge>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown model list */}
      {open && (
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
                    onSelect(model.id);
                    onToggle();
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
                      <span className="font-medium">{model.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {model.provider} · {model.note}
                    </span>
                  </div>
                  <Badge
                    variant={
                      model.badge === "FREE" ? "success" : "warning"
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
  );
}

export function findModel(modelId: string): Model {
  const allModels = MODEL_OPTIONS.flatMap((g) => g.models);
  return (
    allModels.find((m) => m.id === modelId) || allModels[0]
  );
}
