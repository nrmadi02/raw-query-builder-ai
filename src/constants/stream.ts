/**
 * Constants for the AI chat streaming pipeline.
 * Centralizes all magic numbers and configuration values
 * to provide a single source of truth for the app.
 */

/** Maximum number of past conversation turns sent to the LLM for context. */
export const CONTEXT_TURN_WINDOW = 6;

/** Maximum character length for auto-generated conversation titles. */
export const CONVERSATION_TITLE_MAX_LENGTH = 80;

/** Default number of rows per page when executing a SQL query. */
export const DEFAULT_PAGE_SIZE = 10;

/** Default database target for query execution. */
export const DEFAULT_DATABASE = "remote" as const;
