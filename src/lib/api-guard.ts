import { auth } from "@/lib/auth";
import { rateLimiter } from "@/lib/rate-limit";
import { RATE_LIMITS, getRateLimitKey } from "@/lib/rate-limit-config";

interface AuthResult {
  userId: string;
  rateLimitHeaders: Headers;
}

export async function authenticateAndRateLimit(
  request: Request,
  endpoint: keyof typeof RATE_LIMITS,
): Promise<{ ok: true; data: AuthResult } | { ok: false; response: Response }> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const config = RATE_LIMITS[endpoint];
  const key = getRateLimitKey(session.user.id, endpoint);
  const result = rateLimiter.check(key, config.limit, config.windowMs);

  const headers = new Headers({
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetInMs),
  });

  if (!result.allowed) {
    return {
      ok: false,
      response: Response.json(
        { error: "Rate limit exceeded", resetIn: result.resetInMs },
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers),
            "Retry-After": String(Math.ceil(result.resetInMs / 1000)),
          },
        },
      ),
    };
  }

  return { ok: true, data: { userId: session.user.id, rateLimitHeaders: headers } };
}
