"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function useApiFetch() {
  const router = useRouter();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await fetch(input, init);

      if (res.status === 401) {
        try {
          const data = await res.clone().json();
          if (data.error === "Unauthorized") {
            await signOut({
              fetchOptions: {
                onSuccess: () => {
                  router.push("/login");
                },
              },
            });
          }
        } catch {
          // Not JSON — ignore
        }
      }

      if (res.status === 429) {
        const errData = await res.clone().json().catch(() => null);
        const retryAfter = errData?.resetIn
          ? Math.ceil(errData.resetIn / 1000)
          : Number(res.headers.get("Retry-After")) || 60;
        console.warn(`[Rate Limit] Terlalu banyak request. Coba lagi dalam ${retryAfter} detik.`);
      }

      return res;
    },
    [router],
  );
}
