import { NextResponse } from "next/server";
import { validateSQL } from "@/services/sql-guard";
import { prisma } from "@/services/db";
import { queryPrisma } from "@/services/query-db";
import type { PaginationInfo } from "@/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sql, page = 1, pageSize = 10, database = "local" } = body;

    // Select database based on parameter
    const db = database === "remote" ? queryPrisma : prisma;

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

    // Parse and validate pagination parameters
    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const pageSizeNum = Math.max(
      1,
      Math.min(100, parseInt(String(pageSize)) || 10),
    );
    const offset = (pageNum - 1) * pageSizeNum;

    // Remove existing LIMIT and OFFSET from original query for counting
    const baseSql = removeLimitAndOffset(sql);

    // Get total count
    const startCount = performance.now();
    const countResult = await db.$queryRawUnsafe(
      `SELECT COUNT(*) as total FROM (${baseSql}) AS subquery`,
    );
    const countTimeMs =
      Math.round((performance.now() - startCount) * 100) / 100;

    const totalRows = Number((countResult as any)[0]?.total || 0);
    const totalPages = Math.ceil(totalRows / pageSizeNum);

    // Execute paginated query
    const start = performance.now();
    const paginatedSql = `${baseSql} LIMIT ${pageSizeNum} OFFSET ${offset}`;
    const rawRows = await db.$queryRawUnsafe(paginatedSql);
    const executionTimeMs = Math.round((performance.now() - start) * 100) / 100;

    // Serialize BigInt values
    const rows = JSON.parse(
      JSON.stringify(rawRows, (key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      ),
    );

    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    const pagination: PaginationInfo = {
      page: pageNum,
      pageSize: pageSizeNum,
      totalRows,
      totalPages,
    };

    return NextResponse.json({ rows, columns, executionTimeMs, pagination });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to execute query";
    console.error("[SQL Execute Error]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function removeLimitAndOffset(sql: string): string {
  // Simple regex to remove LIMIT and OFFSET clauses
  // This handles most common cases, but complex queries might need more sophisticated parsing
  let cleaned = sql;

  // Remove LIMIT clause
  cleaned = cleaned.replace(/\bLIMIT\s+\d+/gi, "");

  // Remove OFFSET clause
  cleaned = cleaned.replace(/\bOFFSET\s+\d+/gi, "");

  // Clean up any trailing whitespace
  cleaned = cleaned.trim();

  // Remove trailing semicolon if present
  if (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}
