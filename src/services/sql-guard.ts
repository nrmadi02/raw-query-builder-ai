import { Parser } from "node-sql-parser";

const parser = new Parser();

const DANGEROUS_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "EXECUTE",
  "EXEC",
];

const DANGEROUS_FUNCTIONS = [
  "pg_sleep",
  "pg_read_file",
  "pg_write_file",
  "pg_execute_server_program",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "lo_import",
  "lo_export",
  "pg_ls_dir",
  "pg_stat_file",
  "COPY",
  "pg_getnotify",
  "pg_listen",
  "CURRENT_DATABASE",
  "CURRENT_USER",
  "SESSION_USER",
  "PG_BACKEND_PID",
];

interface SQLValidation {
  safe: boolean;
  reason?: string;
}

export function validateSQL(sql: string): SQLValidation {
  if (!sql || sql.trim() === "") {
    return { safe: false, reason: "SQL kosong" };
  }

  const upperSQL = sql.toUpperCase();

  // Check for dangerous top-level keywords
  for (const kw of DANGEROUS_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(sql)) {
      return {
        safe: false,
        reason: `Query mengandung operasi terlarang: ${kw}`,
      };
    }
  }

  // Check for dangerous functions
  for (const fn of DANGEROUS_FUNCTIONS) {
    if (upperSQL.includes(fn.toUpperCase())) {
      return {
        safe: false,
        reason: `Query mengandung fungsi terlarang: ${fn}`,
      };
    }
  }

  // Check for UNION-based injection attempts
  if (/\bUNION\b\s+(ALL\s+)?SELECT\b/i.test(sql)) {
    return {
      safe: false,
      reason: "UNION SELECT tidak diizinkan",
    };
  }

  // Parse with node-sql-parser as secondary check (soft validation)
  // Python sqlglot is the primary guard; if parser fails, allow query
  try {
    const ast = parser.astify(sql, { database: "PostgreSQL" });

    if (Array.isArray(ast) && ast.length > 0) {
      for (const statement of ast) {
        if (statement.type !== "select") {
          return {
            safe: false,
            reason: `Hanya SELECT yang diizinkan, ditemukan: ${statement.type}`,
          };
        }
      }
    }
    // Parser succeeded with SELECT — safe
  } catch {
    // Parser gagal = tidak bisa verifikasi via AST, izinkan saja
    // karena Python sqlglot sudah menjadi gard pertama
  }

  return { safe: true };
}
