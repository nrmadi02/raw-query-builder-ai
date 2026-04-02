import { buildSystemPrompt } from "@/services/prompt-builder";
import { schemaExtractor } from "@/services/schema-extractor";
import { PYTHON_BACKEND_URL } from "@/lib/config";

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

    const systemPrompt = buildSystemPrompt(lastUserMessage);

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
