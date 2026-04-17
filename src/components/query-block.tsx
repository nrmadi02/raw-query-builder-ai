"use client";

import { useState, useRef, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  BarChart2,
  Database,
  ChevronDown,
  Copy,
  Check,
  Download,
  Pencil,
  Play,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ChartRenderer from "@/components/chart-renderer";
import { exportToCSV, exportToExcel } from "@/lib/export";
import type { QueryResult } from "@/types";
import {
  useQueryExecution,
  useQueryMutation,
} from "@/hooks/use-query-execution";

const PAGE_SIZE = 10;

export function QueryBlock({
  query: initialQuery,
  index,
}: {
  query: QueryResult;
  index: number;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sqlExpanded, setSqlExpanded] = useState(false);
  const [editingSQL, setEditingSQL] = useState(false);
  const [editedSQL, setEditedSQL] = useState(query.sql);
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [copiedData, setCopiedData] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const hasLocalEdit = useRef(false);

  // Track whether React Query has taken over pagination (after initial execution completes)
  const [reactQueryActive, setReactQueryActive] = useState(false);

  // Use React Query for query execution with pagination
  // Only activate AFTER the parent has finished the initial execution (status = "completed")
  // This avoids double-fetching during the initial load from use-stream-chat.ts
  const {
    data: queryData,
    isLoading: pageLoading,
    error: queryError,
  } = useQueryExecution(query.sql, currentPage, PAGE_SIZE, {
    enabled: reactQueryActive && !!query.sql,
  });

  // Use React Query for re-running queries
  const mutation = useQueryMutation();

  // Sync local state when parent query changes
  useEffect(() => {
    if (initialQuery.status === "pending") {
      hasLocalEdit.current = false;
      setReactQueryActive(false);
      setCurrentPage(1);
      setQuery(initialQuery);
      return;
    }
    if (hasLocalEdit.current) return;
    if (initialQuery.status === "completed" && !reactQueryActive) {
      // Parent finished initial execution — take over with React Query for pagination
      setReactQueryActive(true);
      setQuery((prev) => ({
        ...prev,
        status: "completed",
        rows: initialQuery.rows,
        columns: initialQuery.columns || prev.columns,
        executionTimeMs: initialQuery.executionTimeMs,
        queryError: null,
        pagination: initialQuery.pagination,
      }));
      return;
    }
    if (
      initialQuery.status === "error" ||
      initialQuery.queryError
    ) {
      setQuery((prev) => ({
        ...prev,
        status: "error",
        queryError: initialQuery.queryError,
        rows: [],
      }));
    }
  }, [initialQuery.status, initialQuery.queryError, reactQueryActive]);

  // Update query when React Query data changes (pagination)
  useEffect(() => {
    if (queryData && reactQueryActive) {
      setQuery((prev) => ({
        ...prev,
        rows: queryData.rows,
        columns: queryData.columns || prev.columns,
        executionTimeMs: queryData.executionTimeMs,
        pagination: queryData.pagination,
      }));
    }
  }, [queryData, reactQueryActive]);

  // Update error state
  useEffect(() => {
    if (queryError && reactQueryActive) {
      setQuery((prev) => ({
        ...prev,
        queryError: queryError.message,
      }));
    }
  }, [queryError, reactQueryActive]);

  // Cleanup timeout refs
  const copiedSQLTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copiedDataTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    return () => {
      clearTimeout(copiedSQLTimer.current);
      clearTimeout(copiedDataTimer.current);
    };
  }, []);

  // Calculate pagination info from server response or fallback to client-side calculation
  const totalPages =
    query.pagination?.totalPages ??
    (query.rows ? Math.ceil(query.rows.length / PAGE_SIZE) : 0);
  const totalRows = query.pagination?.totalRows ?? query.rows?.length ?? 0;
  const displayStart = totalRows > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const displayEnd = Math.min(currentPage * PAGE_SIZE, totalRows);

  const copySQL = async () => {
    await navigator.clipboard.writeText(query.sql);
    setCopiedSQL(true);
    clearTimeout(copiedSQLTimer.current);
    copiedSQLTimer.current = setTimeout(() => setCopiedSQL(false), 2000);
  };

  const copyData = async () => {
    if (!query.rows || query.rows.length === 0) return;
    const headers = Object.keys(query.rows[0]);
    const csv = [
      headers.join(","),
      ...query.rows.map((row) =>
        headers
          .map((h) => {
            const val = String(row[h] ?? "");
            return val.includes(",") || val.includes('"')
              ? `"${val.replace(/"/g, '""')}"`
              : val;
          })
          .join(","),
      ),
    ].join("\n");
    await navigator.clipboard.writeText(csv);
    setCopiedData(true);
    clearTimeout(copiedDataTimer.current);
    copiedDataTimer.current = setTimeout(() => setCopiedData(false), 2000);
  };

  const handleExportCSV = () => {
    if (!query.rows) return;
    exportToCSV(query.rows, `${query.title || "query"}-${index + 1}`);
  };

  const handleExportExcel = () => {
    if (!query.rows) return;
    const columns = query.rows.length > 0 ? Object.keys(query.rows[0]) : [];
    exportToExcel(
      query.rows,
      columns,
      `${query.title || "query"}-${index + 1}`,
    );
  };

  const handleReRun = async () => {
    mutation.mutate(
      {
        sql: editedSQL,
        page: 1,
        pageSize: PAGE_SIZE,
      },
      {
        onSuccess: (data) => {
          setQuery({
            ...query,
            sql: editedSQL,
            rows: data.rows,
            columns: data.columns || query.columns,
            executionTimeMs: data.executionTimeMs,
            pagination: data.pagination,
            queryError: null,
          });
          setEditingSQL(false);
          setCurrentPage(1);
          hasLocalEdit.current = true;
        },
        onError: (err) => {
          setQuery({
            ...query,
            sql: editedSQL,
            rows: [],
            queryError: err.message,
          });
        },
      },
    );
  };

  return (
    <div className="space-y-3 rounded-xl border bg-background overflow-hidden shadow-sm">
      {/* Query Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-muted/30">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Database className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-muted-foreground font-medium">
            #{index + 1}
          </span>
          <span className="text-sm font-semibold text-foreground truncate">
            {query.title || `Query ${index + 1}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {query.executionTimeMs != null && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {query.executionTimeMs}ms
            </Badge>
          )}
          {query.chartType && (
            <Badge
              variant="secondary"
              className="text-[10px] gap-1 px-1.5 py-0"
            >
              <BarChart2 className="w-2.5 h-2.5" />
              {query.chartType}
            </Badge>
          )}
          {query.rows && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {query.rows.length} baris
            </Badge>
          )}
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* SQL Toggle */}
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-950/90">
            <button
              type="button"
              onClick={() => setSqlExpanded((v) => !v)}
              className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
            >
              <Code2 className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                SQL Query
              </span>
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={copySQL}
                className="p-1 rounded hover:bg-zinc-800 transition-colors"
                aria-label="Copy SQL"
              >
                {copiedSQL ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-500" />
                )}
              </button>
              {!editingSQL && query.sql && (
                <button
                  type="button"
                  onClick={() => {
                    setEditedSQL(query.sql);
                    setEditingSQL(true);
                    setSqlExpanded(true);
                  }}
                  className="p-1 rounded hover:bg-zinc-800 transition-colors"
                  aria-label="Edit SQL"
                >
                  <Pencil className="w-3 h-3 text-zinc-500" />
                </button>
              )}
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-zinc-500 transition-transform cursor-pointer",
                  sqlExpanded && "rotate-180",
                )}
                onClick={() => setSqlExpanded((v) => !v)}
              />
            </div>
          </div>
          {sqlExpanded && (
            <div className="bg-zinc-950 px-4 pb-4 pt-2 overflow-x-auto border-t border-zinc-800">
              {editingSQL ? (
                <div className="space-y-2">
                  <textarea
                    value={editedSQL}
                    onChange={(e) => setEditedSQL(e.target.value)}
                    className="w-full min-h-[80px] bg-zinc-900 border border-zinc-700 rounded p-2 text-zinc-100 font-mono text-xs leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleReRun}
                      disabled={mutation.isPending || !editedSQL.trim()}
                      className="gap-1 text-xs"
                    >
                      {mutation.isPending ? (
                        "Menjalankan..."
                      ) : (
                        <>
                          <Play className="w-3 h-3" />
                          Jalankan
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSQL(false)}
                      className="text-xs"
                    >
                      Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <pre className="text-zinc-100 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
                  {query.sql}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Columns metadata */}
        {query.columns?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Kolom:</span>
            <div className="flex flex-wrap gap-1">
              {query.columns.map((col) => (
                <code
                  key={col}
                  className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground/80"
                >
                  {col}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Validation Error (Context) */}
        {query.validationError && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800/40 p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                Pertanyaan Di Luar Konteks
              </p>
              <p className="text-sm text-red-600 dark:text-red-400/90 leading-relaxed">
                {query.validationError}
              </p>
            </div>
          </div>
        )}

        {/* Query Execution Error */}
        {query.queryError && !query.validationError && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800/40 p-3 flex gap-2.5">
            <AlertCircle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-medium text-orange-700 dark:text-orange-400">
                Error Eksekusi
              </p>
              <code className="text-xs text-orange-600 dark:text-orange-400/80 break-all block">
                {query.queryError}
              </code>
            </div>
          </div>
        )}

        {/* Pending state */}
        {query.status === "pending" && !query.queryError && (
          <div className="rounded-lg border bg-muted/20 p-3 flex gap-2.5">
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Menunggu eksekusi query...
            </p>
          </div>
        )}

        {/* Executing state */}
        {query.status === "executing" && !query.queryError && (
          <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-3 flex gap-2.5">
            <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0 mt-0.5" />
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Mengeksekusi query...
            </p>
          </div>
        )}

        {/* Chart Visualization */}
        {query.chartType &&
          query.chartType !== "table" &&
          query.rows &&
          query.rows.length > 0 &&
          !pageLoading && (
            <ChartRenderer data={query.rows} chartType={query.chartType} />
          )}

        {/* Data Table */}
        {query.rows && query.rows.length > 0 && (
          <>
            {/* Table toolbar */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {pageLoading ? (
                  <span className="flex items-center gap-1.5 text-primary">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Memuat halaman {currentPage}...
                  </span>
                ) : totalRows > 0 ? (
                  <>
                    Menampilkan {displayStart}-{displayEnd} dari {totalRows}{" "}
                    baris
                  </>
                ) : (
                  "Tidak ada data"
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={copyData}
                  disabled={pageLoading}
                  className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                  title="Copy Data (CSV)"
                  aria-label="Copy Data as CSV"
                >
                  {copiedData ? (
                    <Check className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={pageLoading}
                  className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                  aria-label="Export CSV"
                >
                  <Download className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={pageLoading}
                  className="p-1.5 rounded hover:bg-muted transition-colors text-[10px] font-medium text-muted-foreground disabled:opacity-40"
                  aria-label="Export Excel"
                >
                  XLS
                </button>
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden relative">
              {pageLoading && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              )}
              <div className="overflow-x-auto">
                <table
                  className={cn(
                    "w-full text-sm transition-opacity",
                    pageLoading && "opacity-50",
                  )}
                >
                  <thead className="border-b bg-muted/20">
                    <tr>
                      {Object.keys(query.rows[0]).map((key) => (
                        <th
                          key={key}
                          className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {query.rows?.map((row, i) => (
                      <tr
                        key={i}
                        className={cn(
                          "border-b last:border-0 transition-colors hover:bg-muted/30",
                          i % 2 === 0 ? "bg-background" : "bg-muted/10",
                        )}
                      >
                        {Object.values(row).map((val, j) => (
                          <td
                            key={j}
                            className="px-4 py-2.5 text-sm whitespace-nowrap text-foreground"
                          >
                            {val !== null && val !== undefined ? (
                              String(val)
                            ) : (
                              <span className="text-muted-foreground italic text-xs">
                                null
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || pageLoading}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages || pageLoading}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty result */}
        {query.rows && query.rows.length === 0 && !query.queryError && (
          <div className="rounded-lg border bg-muted/20 p-3 flex gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Query berhasil dieksekusi, namun tidak ada data{" "}
              <span className="font-medium">(0 rows)</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
