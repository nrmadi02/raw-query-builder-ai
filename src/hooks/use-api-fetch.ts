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

      return res;
    },
    [router],
  );
}
