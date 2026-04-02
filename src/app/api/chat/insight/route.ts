import { PYTHON_BACKEND_URL } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const pythonRes = await fetch(`${PYTHON_BACKEND_URL}/api/insight-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!pythonRes.ok) {
      throw new Error(`Python Backend Error: ${await pythonRes.text()}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = pythonRes.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(
            new TextEncoder().encode(decoder.decode(value, { stream: true })),
          );
        }
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
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Insight generation failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
