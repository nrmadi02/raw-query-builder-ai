interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

interface RateLimitEntry {
  timestamps: number[];
}

const CLEANUP_INTERVAL_MS = 60_000;

export class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof setInterval !== "undefined") {
      this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
      if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
        this.cleanupTimer.unref();
      }
    }
  }

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = this.requests.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      this.requests.set(key, entry);
    }

    // Filter out expired timestamps
    entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

    const remaining = Math.max(0, limit - entry.timestamps.length);

    if (entry.timestamps.length >= limit) {
      const oldestInWindow = entry.timestamps[0];
      const resetInMs = oldestInWindow + windowMs - now;
      return { allowed: false, remaining: 0, resetInMs: Math.max(resetInMs, 0) };
    }

    entry.timestamps.push(now);
    return { allowed: true, remaining: remaining - 1, resetInMs: windowMs };
  }

  private cleanup(): void {
    const now = Date.now();
    const maxWindow = 120_000; // 2 minutes max window
    for (const [key, entry] of this.requests) {
      entry.timestamps = entry.timestamps.filter((ts) => ts > now - maxWindow);
      if (entry.timestamps.length === 0) {
        this.requests.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export const rateLimiter = new RateLimiter();
