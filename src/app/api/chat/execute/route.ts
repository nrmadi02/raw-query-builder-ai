import { NextResponse } from "next/server";
import { validateSQL } from "@/services/sql-guard";
import { prisma } from "@/services/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sql } = body;

    if (!sql || typeof sql !== "string" || sql.trim() === "") {
      return NextResponse.json(
        { error: "SQL query is required" },
        { status: 400 },
      );
    }

    const validation = validateSQL(sql);
    if (!validation.safe) {
      return NextResponse.json({ error: validation.reason }, { status: 403 });
    }

    const start = performance.now();
    const rawRows = await prisma.$queryRawUnsafe(sql);
    const executionTimeMs = Math.round((performance.now() - start) * 100) / 100;

    // Serialize BigInt values
    const rows = JSON.parse(
      JSON.stringify(rawRows, (key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    return NextResponse.json({ rows, columns, executionTimeMs });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to execute query";
    console.error("[SQL Execute Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
