"use client";

import { useState } from "react";
import { Bot, PanelLeftClose, PanelLeft, Square } from "lucide-react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PromptPanel } from "@/components/prompt-panel";
import { ResultsPanel } from "@/components/results-panel";
import { ChatHistory } from "@/components/chat-history";
import ThemeToggle from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { useStreamChat } from "@/hooks/use-stream-chat";
import { useChatHistory } from "@/hooks/use-chat-history";
import { useAppStore, type ChatHistoryEntry } from "@/store/app-store";

export default function Home() {
  const {
    response,
    streamingInsight,
    streamingSQL,
    selectedTables,
    loading,
    loadingStep,
    error,
    historyKey,
    conversationTurns,
    submit,
    cancel,
    reset,
    loadConversation,
  } = useStreamChat();
  const [historyOpen, setHistoryOpen] = useState(false);
  const { refetch: refetchChatHistory } = useChatHistory();

  const handleSubmit = (prompt: string) => {
    submit(prompt);
  };

  const handleHistorySelect = (
    entries: ChatHistoryEntry[],
    conversationId?: string,
  ) => {
    if (entries.length > 0) {
      loadConversation(entries, conversationId);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar */}
      <header className="h-12 border-b flex items-center px-4 gap-3 shrink-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHistoryOpen((v) => !v)}
          className="h-7 w-7"
          aria-label={historyOpen ? "Tutup riwayat" : "Buka riwayat"}
        >
          {historyOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">AI Query Builder</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <span className="text-xs text-muted-foreground">
          Sistem pajak kendaraan bermotor
        </span>
        <div className="flex-1" />
        {loading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={cancel}
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            aria-label="Batalkan proses"
          >
            <Square className="w-3 h-3" />
            Batalkan
          </Button>
        )}
        <ThemeToggle />
        <UserMenu />
      </header>

      {/* Main Layout */}
      <div className="flex-1 overflow-hidden flex">
        {/* Chat History Sidebar */}
        {historyOpen && (
          <div className="w-56 border-r bg-muted/20 shrink-0">
            <ChatHistory onSelect={handleHistorySelect} />
          </div>
        )}

        {/* Main Resizable Layout */}
        <div className="flex-1 overflow-hidden">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize="45%" minSize="30%" maxSize="65%">
              <PromptPanel loading={loading} onSubmit={handleSubmit} hasConversation={conversationTurns.length > 0} onNewConversation={reset} conversationTurns={conversationTurns} />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize="55%" minSize="35%">
              <ResultsPanel
                key={historyKey}
                response={response}
                streamingInsight={streamingInsight}
                streamingSQL={streamingSQL}
                selectedTables={selectedTables}
                loading={loading}
                loadingStep={loadingStep}
                error={error}
                onReset={reset}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
