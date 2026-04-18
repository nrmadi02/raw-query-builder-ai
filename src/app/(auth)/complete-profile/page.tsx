"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Loader2, User } from "lucide-react";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // Redirect if not logged in
    if (!isPending && !session) {
      router.push("/login");
    }
    // Redirect if already has name

    if (!isPending && session?.user?.name) {
      router.push("/dashboard");
    }
  }, [session, isPending, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      // Update user name via API
      const response = await fetch("/api/user/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (response.ok) {
        router.push("/dashboard");
      } else {
        throw new Error("Failed to update name");
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("Gagal memperbarui nama. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-teal-50 via-emerald-50 to-emerald-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-linear-to-br from-teal-600 to-emerald-500 rounded-full flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
            Lengkapi Profil Anda
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Silakan masukkan nama Anda untuk melanjutkan
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
            >
              Nama Lengkap
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masukkan nama Anda"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              required
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full h-12 text-base font-medium bg-linear-to-r from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan dan Lanjutkan"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
