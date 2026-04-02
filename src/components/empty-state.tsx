import { Bot } from "lucide-react";

export function EmptyState() {
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
