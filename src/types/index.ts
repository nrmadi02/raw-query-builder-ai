export interface Model {
  id: string;
  label: string;
  provider: string;
  badge: "FREE" | "PAID";
  envKey: string;
  note: string;
}

export type QueryStatus = "pending" | "executing" | "completed" | "error";

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
}

export interface QueryResult {
  title: string;
  sql: string;
  columns: string[];
  chartType: string;
  rows?: Record<string, unknown>[];
  queryError: string | null;
  validationError?: string;
  executionTimeMs?: number;
  status?: QueryStatus;
  pagination?: PaginationInfo;
}

export interface AIResponse {
  explanation: string;
  insight: string | null;
  queries: QueryResult[];
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}
