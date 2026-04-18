"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

/**
 * A thin fetch wrapper that handles global 401 and 429 responses centrally.
 * - 401: Automatically signs the user out and redirects to /login.
 * - 429: Logs a warning with the retry-after duration.
 */
export function useApiFetch(): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  const router = useRouter();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const res = await fetch(input, init);

      if (res.status === 401) {
        try {
          const data = await res.clone().json() as { error?: string };
          if (data.error === "Unauthorized") {
            await signOut({
              fetchOptions: {
                onSuccess: () => router.push("/login"),
              },
            });
          }
        } catch {
          // Response is not JSON — ignore and let the caller handle it
        }
      }

      if (res.status === 429) {
        const errData = await res.clone().json().catch(() => null) as { resetIn?: number } | null;
        const retryAfter = errData?.resetIn
          ? Math.ceil(errData.resetIn / 1000)
          : Number(res.headers.get("Retry-After")) || 60;
        console.warn(`[Rate Limit] Too many requests. Retry in ${retryAfter}s.`);
      }

      return res;
    },
    [router],
  );
}
