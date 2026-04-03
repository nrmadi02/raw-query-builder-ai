import {
  buildSystemPrompt,
  buildTableSelectionPrompt,
  type DatabaseType,
} from "@/services/prompt-builder";
import { querySchemaExtractor } from "@/services/query-schema-extractor";
import { PYTHON_BACKEND_URL } from "@/lib/config";

// Default database untuk Samsat Kalimantan Selatan
const DEFAULT_DATABASE: DatabaseType = "remote";

export async function POST(req: Request) {
  try {
    const { messages, model, database } = await req.json();
    const selectedModel = model || "gemini/gemini-2.0-flash-exp";
    const selectedDatabase: DatabaseType = database || DEFAULT_DATABASE;
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

    // Validate context menggunakan query schema extractor untuk Samsat
    const validation = querySchemaExtractor.validateContext(lastUserMessage);

    if (!validation.isValid) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: metadata\ndata: ${JSON.stringify({
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

    // ── STEP 1: Select relevant tables (Two-Step LLM) ──
    let selectedTables: string[] | undefined;

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
          model: selectedModel,
        }),
      });

      if (selectRes.ok) {
        const selectResult = await selectRes.json();
        selectedTables = selectResult.tables;
        console.log(`[Stream Route] Table Selection: ${selectedTables?.length || 0} tables`, selectedTables);
      } else {
        console.warn("[Stream Route] Table Selection failed, using full schema");
      }
    } catch (err) {
      console.warn("[Stream Route] Table Selection error, using full schema:", err);
    }

    // ── STEP 2: Build prompt with filtered schema ──
    const systemPrompt = buildSystemPrompt(lastUserMessage, selectedDatabase, selectedTables);

    console.log("[Stream Route] Sending to Python backend:", {
      model: selectedModel,
      database: selectedDatabase,
      userMessage: lastUserMessage?.substring(0, 50),
    });

    const pythonBackendRes = await fetch(`${PYTHON_BACKEND_URL}/api/generate`, {
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

    const pendingQueries = queries.map((q: any) => ({
      ...q,
      rows: undefined,
      queryError: null,
      status: "pending",
    }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        };

        sendEvent("metadata", {
          explanation: result.explanation,
          fallbackInsight: result.insight || null,
          queries: pendingQueries,
        });

        sendEvent("done", {});
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
