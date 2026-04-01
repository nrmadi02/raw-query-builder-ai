import { NextResponse } from "next/server";
import { buildSystemPrompt } from "@/services/prompt-builder";
import { prisma } from "@/services/db";
import { schemaExtractor } from "@/services/schema-extractor";

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

    // ── STEP 2: Eksekusi setiap query ke DB, kumpulkan rows ──
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

    // ── STEP 3: Generate insight berdasarkan data NYATA ──
    // Kirim hasil rows ke AI untuk insight yang akurat, bukan generic
    let finalInsight: string | null = null;
    const queriesWithData = executedQueries.filter(
      (q) => q.rows && q.rows.length > 0,
    );

    if (queriesWithData.length > 0) {
      try {
        const insightRes = await fetch("http://localhost:8000/api/insight", {
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
        });

        if (insightRes.ok) {
          const insightData = await insightRes.json();
          finalInsight = insightData.insight || null;
        }
      } catch (err) {
        console.error("Insight generation failed (non-critical):", err);
        // Fallback ke insight generic dari AI jika endpoint insight gagal
        finalInsight = result.insight || null;
      }
    }

    return NextResponse.json({
      explanation: result.explanation,
      insight: finalInsight,
      queries: executedQueries,
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
