import { NextResponse } from "next/server";
import { buildSystemPrompt, buildTableSelectionPrompt, buildConversationContext, type DatabaseType } from "@/services/prompt-builder";
import { schemaExtractor } from "@/services/schema-extractor";
import { querySchemaExtractor } from "@/services/query-schema-extractor";
import { PYTHON_BACKEND_URL } from "@/lib/config";
import { authenticateAndRateLimit } from "@/lib/api-guard";
import { queryCache, CACHE_TTL } from "@/lib/query-cache";
import { generateCacheKey } from "@/lib/cache-hash";
import type { AIResponse, ConversationTurn, Message } from "@/types";

export async function POST(req: Request) {
  const guard = await authenticateAndRateLimit(req, "chat");
  if (!guard.ok) return guard.response;
  const { rateLimitHeaders } = guard.data;

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

    // ── STEP 0.5: Check cache ──
    const cacheKey = await generateCacheKey({
      question: lastUserMessage,
      database: selectedDatabase,
      contextHash: convContext,
    });
    const cached = queryCache.get<{ tables: string[]; response: AIResponse }>(cacheKey);
    if (cached) {
      const response = NextResponse.json({
        explanation: cached.response.explanation,
        insight: null,
        queries: cached.response.queries.map((q) => ({
          ...q,
          rows: undefined,
          queryError: null,
          status: "pending",
        })),
      });
      response.headers.set("X-Cache", "HIT");
      rateLimitHeaders.forEach((v, k) => response.headers.set(k, v));
      return response;
    }

    // ── STEP 1: Select relevant tables (Two-Step LLM) ──
    let selectedTables: string[] | undefined;

    if (selectedDatabase === "remote") {
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
            const selectResult = await selectRes.json();
            selectedTables = selectResult.tables;
            if (selectedTables) {
              queryCache.set(tableCacheKey, selectedTables, CACHE_TTL.TABLE_SELECTION);
            }
          }
        } catch (err) {
          console.warn("[Table Selection] ✗ Error, using full schema as fallback:", err);
        }
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

    const queries: unknown[] = result.queries || [];
    const pendingQueries = queries.map((q) => ({
      ...(q as Record<string, unknown>),
      rows: undefined,
      queryError: null,
      status: "pending",
    }));

    // Cache the result
    const aiResponse: AIResponse = {
      explanation: result.explanation as string,
      insight: null,
      queries: pendingQueries as AIResponse["queries"],
    };
    queryCache.set(cacheKey, { tables: selectedTables || [], response: aiResponse }, CACHE_TTL.SQL_GENERATION);

    const response = NextResponse.json({
      explanation: result.explanation,
      insight: null,
      queries: pendingQueries,
    });
    response.headers.set("X-Cache", "MISS");
    rateLimitHeaders.forEach((v, k) => response.headers.set(k, v));
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan proxy menuju Python Backend";
    console.error("Error in AI Route:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
