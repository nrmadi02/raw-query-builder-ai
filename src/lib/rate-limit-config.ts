export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  chat: { limit: 20, windowMs: 60_000 },
  execute: { limit: 30, windowMs: 60_000 },
  insight: { limit: 20, windowMs: 60_000 },
} as const;

export function getRateLimitKey(userId: string, endpoint: string): string {
  return `${userId}:${endpoint}`;
}
