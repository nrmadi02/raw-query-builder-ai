import { NextResponse } from "next/server";
import { buildSystemPrompt, buildTableSelectionPrompt, buildConversationContext, type DatabaseType } from "@/services/prompt-builder";
import { schemaExtractor } from "@/services/schema-extractor";
import { querySchemaExtractor } from "@/services/query-schema-extractor";
import { PYTHON_BACKEND_URL } from "@/lib/config";
import type { ConversationTurn, Message } from "@/types";

export async function POST(req: Request) {
  try {
    const { messages, database = "local", conversationTurns = [] } = (await req.json()) as {
      messages: Message[];
      database?: DatabaseType;
      conversationTurns?: ConversationTurn[];
    };
    const selectedDatabase: DatabaseType = database === "remote" ? "remote" : "local";
    const lastUserMessage = messages[messages.length - 1]?.content;
    const convContext = buildConversationContext(conversationTurns);

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 },
      );
    }

    // ── STEP 0: Validasi konteks pertanyaan ──
    const validation = selectedDatabase === "remote"
      ? querySchemaExtractor.validateContext(lastUserMessage)
      : schemaExtractor.validateContext(lastUserMessage);

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

    // ── STEP 1: Select relevant tables (Two-Step LLM) ──
    let selectedTables: string[] | undefined;

    if (selectedDatabase === "remote") {
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
          const selectResult = await selectRes.json();
          selectedTables = selectResult.tables;
          console.log(`[Table Selection] ✓ Selected ${selectedTables?.length || 0} tables:`, selectedTables);
        } else {
          console.warn("[Table Selection] ✗ Failed, using full schema as fallback");
        }
      } catch (err) {
        console.warn("[Table Selection] ✗ Error, using full schema as fallback:", err);
      }
    }

    const systemPrompt = buildSystemPrompt(lastUserMessage, selectedDatabase, selectedTables, convContext);

    // Build message history for LLM
    const historyMessages: Message[] = [{ role: "system", content: systemPrompt }];
    for (const turn of conversationTurns.slice(-6)) {
      historyMessages.push({ role: turn.role, content: turn.content });
    }
    historyMessages.push({ role: "user", content: lastUserMessage });

    // ── STEP 2: Generate SQL queries dari AI ──
    const pythonBackendRes = await fetch(`${PYTHON_BACKEND_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: historyMessages,
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
