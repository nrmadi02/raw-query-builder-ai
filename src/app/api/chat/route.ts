import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/services/prompt-builder";
import { schemaExtractor } from "@/services/schema-extractor";
import { PYTHON_BACKEND_URL } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();
    const selectedModel = model || "gemini/gemini-2.0-flash";
    const lastUserMessage = messages[messages.length - 1]?.content;

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    // ── STEP 0: Validasi konteks pertanyaan ──
    const validation = schemaExtractor.validateContext(lastUserMessage);

    if (!validation.isValid) {
      return NextResponse.json({
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
      });
    }

    console.log(
      `[Context Validation] ✓ Valid (${validation.confidence} confidence)`,
      validation.matchedTables?.length
        ? `Tables: ${validation.matchedTables.join(", ")}`
        : "",
    );

    const systemPrompt = buildSystemPrompt(lastUserMessage);

    // ── STEP 1: Generate SQL queries dari AI ──
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

    return NextResponse.json({
      explanation: result.explanation,
      insight: null,
      queries: pendingQueries,
    });
  } catch (error: any) {
    console.error("Error in AI Route:", error);
    return NextResponse.json(
      {
        error:
          error?.message || "Terjadi kesalahan proxy menuju Python Backend",
      },
      { status: 500 },
    );
  }
}
