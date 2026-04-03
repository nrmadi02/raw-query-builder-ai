import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginationInfo } from "@/types";

// Types
interface ExecuteQueryVariables {
  sql: string;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

interface ExecuteQueryResponse {
  rows: Record<string, unknown>[];
  columns: string[];
  executionTimeMs: number;
  pagination: PaginationInfo;
}

// Query function
async function executeQuery({
  sql,
  page = 1,
  pageSize = 10,
  signal,
}: ExecuteQueryVariables): Promise<ExecuteQueryResponse> {
  const res = await fetch("/api/chat/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, page, pageSize, database: "remote" }), // Gunakan database Samsat
    signal,
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to execute query");
  }

  return res.json();
}

// Hook for fetching paginated query results
export function useQueryExecution(
  sql: string,
  page: number = 1,
  pageSize: number = 10,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ["queryExecution", sql, page, pageSize],
    queryFn: ({ signal }) => executeQuery({ sql, page, pageSize, signal }),
    enabled: options?.enabled !== false && !!sql,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook for mutating (re-running) a query
export function useQueryMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sql,
      page = 1,
      pageSize = 10,
    }: {
      sql: string;
      page?: number;
      pageSize?: number;
    }) => {
      return executeQuery({ sql, page, pageSize });
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({
        queryKey: ["queryExecution", variables.sql],
      });
    },
  });
}

// Hook for fetching a specific page
export function useQueryPage(sql: string) {
  const queryClient = useQueryClient();

  return async function fetchPage(page: number, pageSize: number = 10) {
    return queryClient.fetchQuery({
      queryKey: ["queryExecution", sql, page, pageSize],
      queryFn: ({ signal }) => executeQuery({ sql, page, pageSize, signal }),
    });
  };
}
