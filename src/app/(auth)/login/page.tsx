"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { Loader2, Database, Sparkles } from "lucide-react";
import { useState } from "react";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/complete-profile",
      });
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Gradient Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 via-emerald-500 to-emerald-400 p-12 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <Database className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">
              AI Query Builder
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Ubah Pertanyaan Menjadi Query SQL secara Otomatis
          </h1>
          <p className="text-lg text-white/80">
            Gunakan kekuatan AI untuk menghasilkan query SQL dari bahasa alami.
            Hemat waktu dan tingkatkan produktivitas Anda.
          </p>
          <div className="flex items-center gap-2 text-white/70">
            <Sparkles className="h-5 w-5" />
            <span>Cepat, Akurat, dan Mudah Digunakan</span>
          </div>
        </div>

        <div className="relative z-10 text-white/60 text-sm">
          © {new Date().getFullYear()} AI Query Builder. Semua hak dilindungi.
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Header */}
          <div className="lg:hidden text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Database className="h-8 w-8 text-emerald-600" />
              <span className="text-2xl font-bold">AI Query Builder</span>
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50">
              Selamat Datang
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Masuk untuk mengakses dashboard Anda
            </p>
          </div>

          {/* Login Form */}
          <div className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full h-12 text-base font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-all shadow-sm"
              variant="outline"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Lanjutkan dengan Google
                </>
              )}
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            Dengan masuk, Anda menyetujui{" "}
            <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
              Syarat Layanan
            </span>{" "}
            dan{" "}
            <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
              Kebijakan Privasi
            </span>{" "}
            kami
          </p>
        </div>
      </div>
    </div>
  );
}
