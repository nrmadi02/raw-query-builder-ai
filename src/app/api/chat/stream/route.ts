import { buildSystemPrompt } from "@/services/prompt-builder";
import { prisma } from "@/services/db";
import { schemaExtractor } from "@/services/schema-extractor";

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();
    const selectedModel = model || "gemini/gemini-2.0-flash-exp";
    const lastUserMessage = messages[messages.length - 1]?.content;

    if (!lastUserMessage) {
      return new Response(
        JSON.stringify({ error: "Message content is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const validation = schemaExtractor.validateContext(lastUserMessage);

    if (!validation.isValid) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: metadata\ndata: ${JSON.stringify({
                explanation: "Pertanyaan di luar konteks",
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
                  },
                ],
              })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const systemPrompt = buildSystemPrompt(lastUserMessage);

    const pythonBackendRes = await fetch("http://localhost:8000/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: lastUserMessage },
        ],
        model: selectedModel,
      }),
    });

    if (!pythonBackendRes.ok) {
      throw new Error(`Python Backend Error: ${await pythonBackendRes.text()}`);
    }

    const result = await pythonBackendRes.json();

    const queries: any[] = result.queries || [];
    const executedQueries = await Promise.all(
      queries.map(async (queryObj: any) => {
        if (!queryObj.sql || queryObj.sql.trim() === "") {
          return {
            ...queryObj,
            rows: [],
            queryError:
              queryObj.validationError || "SQL kosong atau tidak valid",
          };
        }

        try {
          let rows = await prisma.$queryRawUnsafe(queryObj.sql);
          rows = JSON.parse(
            JSON.stringify(rows, (key, value) =>
              typeof value === "bigint" ? value.toString() : value,
            ),
          );
          return { ...queryObj, rows, queryError: null };
        } catch (error: any) {
          console.error(`Database execution error (${queryObj.title}):`, error);
          return {
            ...queryObj,
            rows: [],
            queryError: error.message,
          };
        }
      }),
    );

    const queriesWithData = executedQueries.filter(
      (q) => q.rows && q.rows.length > 0,
    );

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          console.log(`[SSE] ${event}:`, JSON.stringify(data).slice(0, 100));
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };

        try {
          sendEvent("metadata", {
            explanation: result.explanation,
            queries: executedQueries,
          });

          if (queriesWithData.length > 0) {
            try {
              console.log("[Stream] Calling insight-stream endpoint...");
              const insightRes = await fetch(
                "http://localhost:8000/api/insight-stream",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_question: lastUserMessage,
                    query_results: queriesWithData.map((q) => ({
                      title: q.title,
                      rows: q.rows,
                    })),
                    model: selectedModel,
                  }),
                },
              );

              if (insightRes.ok) {
                console.log("[Stream] Insight stream connected");
                const reader = insightRes.body?.getReader();
                if (reader) {
                  const decoder = new TextDecoder();
                  let buffer = "";

                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                      console.log("[Stream] Insight stream done");
                      break;
                    }

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                      if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") {
                          console.log("[Stream] Received [DONE] from Python");
                        } else {
                          try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                              sendEvent("insight", { content: parsed.content });
                            } else if (parsed.error) {
                              console.error(
                                "[Stream] Insight error:",
                                parsed.error,
                              );
                              sendEvent("insight", {
                                content:
                                  result.insight || "Gagal membuat insight",
                              });
                            }
                          } catch {
                            // Skip invalid JSON
                          }
                        }
                      }
                    }
                  }
                }
              } else {
                console.log("[Stream] Insight stream failed, using fallback");
                if (result.insight) {
                  sendEvent("insight", { content: result.insight });
                }
              }
            } catch (err) {
              console.error("[Stream] Insight streaming error:", err);
              if (result.insight) {
                sendEvent("insight", { content: result.insight });
              }
            }
          } else {
            console.log("[Stream] No data to analyze");
          }

          sendEvent("done", {});
          controller.close();
        } catch (err) {
          console.error("[Stream] Error in stream:", err);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Error in Stream Route:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Terjadi kesalahan" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
