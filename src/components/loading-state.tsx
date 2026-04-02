import { Loader2 } from "lucide-react";

export function LoadingState({
  modelLabel,
  step,
}: {
  modelLabel: string;
  step?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-foreground">Sedang menganalisa...</h3>
        {step && (
          <p className="text-xs text-primary animate-pulse">{step}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Menggunakan{" "}
          <span className="font-medium text-foreground">{modelLabel}</span>
        </p>
      </div>
    </div>
  );
}
