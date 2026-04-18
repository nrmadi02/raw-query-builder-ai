import {
  buildSystemPrompt,
  buildTableSelectionPrompt,
  buildConversationContext,
  type DatabaseType,
} from "@/services/prompt-builder";
import { querySchemaExtractor } from "@/services/query-schema-extractor";
import { PYTHON_BACKEND_URL } from "@/lib/config";
import { authenticateAndRateLimit } from "@/lib/api-guard";
import { queryCache, CACHE_TTL } from "@/lib/query-cache";
import { generateCacheKey } from "@/lib/cache-hash";
import type { AIResponse, ConversationTurn, Message, QueryResult } from "@/types";
import {
  CONTEXT_TURN_WINDOW,
  DEFAULT_DATABASE,
} from "@/constants/stream";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Shape of the final result object returned by the Python backend
 * when generation is complete (status === "complete").
 */
interface PythonFinalResult {
  explanation: string;
  queries: unknown[];
  insight: string | null;
}

/** Shape of a query entry as it exists before execution (status = "pending"). */
interface PendingQuery extends Omit<QueryResult, "rows" | "queryError" | "status"> {
  rows: undefined;
  queryError: null;
  status: "pending";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encodes and enqueues an SSE event into the stream controller.
 */
function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  event: string,
  data: unknown,
): void {
  controller.enqueue(
    encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
  );
}

/**
 * Sends a "step" SSE event to update the client on the current pipeline stage.
 */
function sendStep(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  step: string,
  message: string,
): void {
  sendEvent(controller, encoder, "step", { step, message });
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<Response> {
  const guard = await authenticateAndRateLimit(req, "chat");
  if (!guard.ok) return guard.response;
  const { rateLimitHeaders } = guard.data;

  const encoder = new TextEncoder();

  try {
    const {
      messages,
      database,
      conversationTurns = [],
    } = (await req.json()) as {
      messages: Message[];
      database?: DatabaseType;
      conversationTurns?: ConversationTurn[];
    };

    const selectedDatabase: DatabaseType = database ?? DEFAULT_DATABASE;
    const lastUserMessage = messages[messages.length - 1]?.content;
    const convContext = buildConversationContext(conversationTurns);

    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: "Message content is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check full-response cache before streaming
    const cacheKey = await generateCacheKey({
      question: lastUserMessage,
      database: selectedDatabase,
      contextHash: convContext,
    });
    const cached = queryCache.get<{ tables: string[]; response: AIResponse }>(cacheKey);
    const cacheHit = !!cached;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step 1: Validate question context
          sendStep(controller, encoder, "validating", "Memvalidasi pertanyaan...");
          const validation = querySchemaExtractor.validateContext(lastUserMessage);

          if (!validation.isValid) {
            sendEvent(controller, encoder, "metadata", {
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
            sendEvent(controller, encoder, "done", {});
            controller.close();
            return;
          }

          // Step 2: Serve from cache if available
          if (cached) {
            sendStep(controller, encoder, "cache_hit", "Mengambil dari cache...");
            sendEvent(controller, encoder, "tables_selected", {
              tables: cached.tables ?? [],
            });

            const cachedSQL = cached.response.queries
              .map((q) => q.sql)
              .filter(Boolean)
              .join("\n\n");

            if (cachedSQL) {
              sendEvent(controller, encoder, "sql_chunk", { content: cachedSQL });
            }

            sendEvent(controller, encoder, "metadata", {
              explanation: cached.response.explanation,
              fallbackInsight: cached.response.insight,
              queries: cached.response.queries.map((q) => ({
                ...q,
                rows: undefined,
                queryError: null,
                status: "pending",
              })),
            });
            sendEvent(controller, encoder, "done", {});
            controller.close();
            return;
          }

          // Step 3: Select relevant tables
          sendStep(controller, encoder, "selecting_tables", "Memilih tabel yang relevan...");
          let selectedTables: string[] | undefined;

          const tableCacheKey = await generateCacheKey({
            question: lastUserMessage,
            database: selectedDatabase,
            type: "table_selection",
          });
          const cachedTables = queryCache.get<string[]>(tableCacheKey);

          if (cachedTables) {
            selectedTables = cachedTables;
          } else {
            try {
              const tableSelectionPrompt = buildTableSelectionPrompt(lastUserMessage);
              const selectRes = await fetch(`${PYTHON_BACKEND_URL}/api/select-tables`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [
                    { role: "system", content: tableSelectionPrompt },
                    { role: "user", content: lastUserMessage },
                  ],
                }),
              });

              if (selectRes.ok) {
                const selectResult = await selectRes.json() as { tables?: string[] };
                selectedTables = selectResult.tables;
                if (selectedTables) {
                  queryCache.set(tableCacheKey, selectedTables, CACHE_TTL.TABLE_SELECTION);
                }
              }
            } catch (err) {
              console.warn("[Stream Route] Table selection error, using full schema:", err);
            }
          }

          sendEvent(controller, encoder, "tables_selected", {
            tables: selectedTables ?? [],
          });

          // Step 4: Build system prompt with filtered schema + conversation context
          const systemPrompt = buildSystemPrompt(
            lastUserMessage,
            selectedDatabase,
            selectedTables,
            convContext,
          );

          // Build message history: system prompt + last N turns + current user message
          const historyMessages: Message[] = [{ role: "system", content: systemPrompt }];
          for (const turn of conversationTurns.slice(-CONTEXT_TURN_WINDOW)) {
            historyMessages.push({ role: turn.role, content: turn.content });
          }
          historyMessages.push({ role: "user", content: lastUserMessage });

          // Step 5: Stream SQL generation from Python backend
          sendStep(controller, encoder, "generating_sql", "AI sedang membuat query...");

          const pythonRes = await fetch(`${PYTHON_BACKEND_URL}/api/generate-stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: historyMessages }),
            signal: req.signal,
          });

          if (!pythonRes.ok) {
            throw new Error(`Python Backend Error: ${await pythonRes.text()}`);
          }

          const reader = pythonRes.body?.getReader();
          if (!reader) {
            throw new Error("Failed to get Python backend response reader");
          }

          const decoder = new TextDecoder();
          let buffer = "";
          let finalResult: PythonFinalResult | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop() ?? "";

            for (const part of parts) {
              if (!part.trim()) continue;

              const lines = part.split("\n");
              let dataStr = "";
              for (const line of lines) {
                if (line.startsWith("data:")) dataStr = line.slice(5).trim();
              }

              if (!dataStr || dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr) as {
                  error?: string;
                  status?: string;
                  result?: PythonFinalResult;
                  content?: string;
                };

                if (parsed.error) {
                  sendEvent(controller, encoder, "error", { message: parsed.error });
                  sendEvent(controller, encoder, "done", {});
                  controller.close();
                  return;
                }

                if (parsed.status === "complete" && parsed.result) {
                  finalResult = parsed.result;
                } else if (parsed.content) {
                  sendEvent(controller, encoder, "sql_chunk", { content: parsed.content });
                }
              } catch {
                // Skip invalid JSON chunks from the stream
              }
            }
          }

          // Step 6: Send final metadata or report error
          if (!finalResult) {
            sendEvent(controller, encoder, "error", { message: "Tidak ada response dari AI" });
            sendEvent(controller, encoder, "done", {});
            controller.close();
            return;
          }

          const pendingQueries: PendingQuery[] = finalResult.queries.map((q) => ({
            ...(q as Omit<QueryResult, "rows" | "queryError" | "status">),
            rows: undefined,
            queryError: null,
            status: "pending" as const,
          }));

          sendEvent(controller, encoder, "metadata", {
            explanation: finalResult.explanation,
            fallbackInsight: finalResult.insight,
            queries: pendingQueries,
          });

          // Cache the result for future identical requests
          const aiResponse: AIResponse = {
            explanation: finalResult.explanation,
            insight: finalResult.insight,
            queries: pendingQueries as AIResponse["queries"],
          };
          queryCache.set(
            cacheKey,
            { tables: selectedTables ?? [], response: aiResponse },
            CACHE_TTL.SQL_GENERATION,
          );

          sendEvent(controller, encoder, "done", {});
          controller.close();
        } catch (streamError: unknown) {
          const message =
            streamError instanceof Error ? streamError.message : "Terjadi kesalahan";
          console.error("[Stream Route] Error:", message);
          try {
            sendEvent(controller, encoder, "error", { message });
            sendEvent(controller, encoder, "done", {});
          } catch {
            // Controller may already be closed — safe to ignore
          }
          controller.close();
        }
      },
    });

    const responseHeaders = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Cache": cacheHit ? "HIT" : "MISS",
    });
    rateLimitHeaders.forEach((value, key) => responseHeaders.set(key, value));

    return new Response(stream, { headers: responseHeaders });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan";
    console.error("[Stream Route] Outer error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
