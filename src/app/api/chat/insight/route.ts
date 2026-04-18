import { PYTHON_BACKEND_URL } from "@/lib/config";
import { authenticateAndRateLimit } from "@/lib/api-guard";
import { queryCache, CACHE_TTL } from "@/lib/query-cache";
import { generateCacheKey } from "@/lib/cache-hash";

export async function POST(req: Request) {
  const guard = await authenticateAndRateLimit(req, "insight");
  if (!guard.ok) return guard.response;
  const { rateLimitHeaders } = guard.data;

  try {
    const { model, ...body } = await req.json();

    // Check cache for insight
    const cacheKey = await generateCacheKey({
      question: body.user_question,
      resultsHash: JSON.stringify(body.query_results),
      type: "insight",
    });
    const cachedInsight = queryCache.get<string>(cacheKey);

    if (cachedInsight) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: cachedInsight })}\n\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "complete" })}\n\n`));
          controller.close();
        },
      });
      const responseHeaders = new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Cache": "HIT",
      });
      rateLimitHeaders.forEach((v, k) => responseHeaders.set(k, v));
      return new Response(stream, { headers: responseHeaders });
    }

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

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let collectedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          controller.enqueue(encoder.encode(chunk));

          // Extract content for caching
          const parts = chunk.split("\n\n");
          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (line.startsWith("data:")) {
                try {
                  const parsed = JSON.parse(line.slice(5).trim());
                  if (parsed.content) collectedContent += parsed.content;
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
        }

        if (collectedContent) {
          queryCache.set(cacheKey, collectedContent, CACHE_TTL.INSIGHT);
        }
        controller.close();
      },
    });

    const responseHeaders = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Cache": "MISS",
    });
    rateLimitHeaders.forEach((v, k) => responseHeaders.set(k, v));
    return new Response(stream, { headers: responseHeaders });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Insight generation failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
