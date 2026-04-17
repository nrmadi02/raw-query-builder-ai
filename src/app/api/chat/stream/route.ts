import {
  buildSystemPrompt,
  buildTableSelectionPrompt,
  buildConversationContext,
  type DatabaseType,
} from "@/services/prompt-builder";
import { querySchemaExtractor } from "@/services/query-schema-extractor";
import { PYTHON_BACKEND_URL } from "@/lib/config";
import type { ConversationTurn, Message } from "@/types";

const DEFAULT_DATABASE: DatabaseType = "remote";

export async function POST(req: Request) {
  const encoder = new TextEncoder();

  const sendEvent = (
    controller: ReadableStreamDefaultController,
    event: string,
    data: unknown,
  ) => {
    controller.enqueue(
      encoder.encode(
        `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
      ),
    );
  };

  const sendStep = (
    controller: ReadableStreamDefaultController,
    step: string,
    message: string,
  ) => {
    sendEvent(controller, "step", { step, message });
  };

  try {
    const { messages, database, conversationTurns = [] } = (await req.json()) as {
      messages: Message[];
      database?: DatabaseType;
      conversationTurns?: ConversationTurn[];
    };
    const selectedDatabase: DatabaseType = database || DEFAULT_DATABASE;
    const lastUserMessage = messages[messages.length - 1]?.content;
    const convContext = buildConversationContext(conversationTurns);

    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: "Message content is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: Validate context
          sendStep(controller, "validating", "Memvalidasi pertanyaan...");
          const validation =
            querySchemaExtractor.validateContext(lastUserMessage);

          if (!validation.isValid) {
            sendEvent(controller, "metadata", {
              explanation: "Pertanyaan di luar konteks database Samsat",
              insight: null,
              queries: [
                {
                  title: "Validasi Gagal",
                  sql: "",
                  columns: [],
                  chartType: "table",
                  rows: [],
                  queryError: validation.reason,
                  validationError: validation.reason,
                  status: "error",
                },
              ],
            });
            sendEvent(controller, "done", {});
            controller.close();
            return;
          }

          // Step 2: Select relevant tables
          sendStep(
            controller,
            "selecting_tables",
            "Memilih tabel yang relevan...",
          );
          let selectedTables: string[] | undefined;

          try {
            const tableSelectionPrompt =
              buildTableSelectionPrompt(lastUserMessage);
            const selectRes = await fetch(
              `${PYTHON_BACKEND_URL}/api/select-tables`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [
                    { role: "system", content: tableSelectionPrompt },
                    { role: "user", content: lastUserMessage },
                  ],
                }),
              },
            );

            if (selectRes.ok) {
              const selectResult = await selectRes.json();
              selectedTables = selectResult.tables;
              console.log(
                `[Stream Route] Table Selection: ${selectedTables?.length || 0} tables`,
                selectedTables,
              );
            } else {
              console.warn(
                "[Stream Route] Table Selection failed, using full schema",
              );
            }
          } catch (err) {
            console.warn(
              "[Stream Route] Table Selection error, using full schema:",
              err,
            );
          }

          sendEvent(controller, "tables_selected", {
            tables: selectedTables || [],
          });

          // Step 3: Build prompt with filtered schema + conversation context
          const systemPrompt = buildSystemPrompt(
            lastUserMessage,
            selectedDatabase,
            selectedTables,
            convContext,
          );

          // Build message history for LLM: system + prior turns + current user message
          const historyMessages: Message[] = [{ role: "system", content: systemPrompt }];
          for (const turn of conversationTurns.slice(-6)) {
            historyMessages.push({ role: turn.role, content: turn.content });
          }
          historyMessages.push({ role: "user", content: lastUserMessage });

          // Step 4: Stream SQL generation from Python backend
          sendStep(
            controller,
            "generating_sql",
            "AI sedang membuat query...",
          );

          const pythonRes = await fetch(
            `${PYTHON_BACKEND_URL}/api/generate-stream`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: historyMessages,
              }),
              signal: req.signal,
            },
          );

          if (!pythonRes.ok) {
            throw new Error(
              `Python Backend Error: ${await pythonRes.text()}`,
            );
          }

          const reader = pythonRes.body?.getReader();
          if (!reader) {
            throw new Error("Failed to get Python backend response reader");
          }

          const decoder = new TextDecoder();
          let buffer = "";
          let finalResult: Record<string, unknown> | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
              if (!part.trim()) continue;

              const lines = part.split("\n");
              let dataStr = "";
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataStr = line.slice(5).trim();
                }
              }

              if (!dataStr || dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);

                if (parsed.error) {
                  sendEvent(controller, "error", {
                    message: parsed.error,
                  });
                  sendEvent(controller, "done", {});
                  controller.close();
                  return;
                }

                if (parsed.status === "complete" && parsed.result) {
                  finalResult = parsed.result as Record<string, unknown>;
                } else if (parsed.content) {
                  // Forward LLM token chunks to frontend
                  sendEvent(controller, "sql_chunk", {
                    content: parsed.content,
                  });
                }
              } catch {
                // Skip invalid JSON chunks
              }
            }
          }

          // Step 5: Send final metadata
          if (!finalResult) {
            sendEvent(controller, "error", {
              message: "Tidak ada response dari AI",
            });
            sendEvent(controller, "done", {});
            controller.close();
            return;
          }

          const queries: unknown[] =
            (finalResult.queries as unknown[]) || [];
          const pendingQueries = queries.map((q) => ({
            ...(q as Record<string, unknown>),
            rows: undefined,
            queryError: null,
            status: "pending",
          }));

          sendEvent(controller, "metadata", {
            explanation: finalResult.explanation,
            fallbackInsight: (finalResult as Record<string, unknown>)
              .insight || null,
            queries: pendingQueries,
          });

          sendEvent(controller, "done", {});
          controller.close();
        } catch (streamError: unknown) {
          const message =
            streamError instanceof Error
              ? streamError.message
              : "Terjadi kesalahan";
          console.error("[Stream Route] Error:", message);
          try {
            sendEvent(controller, "error", { message });
            sendEvent(controller, "done", {});
          } catch {
            // Controller may already be closed
          }
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Terjadi kesalahan";
    console.error("[Stream Route] Outer error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
