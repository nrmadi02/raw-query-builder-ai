"use client";

import Link from "next/link";
import { Database } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-emerald-500 flex items-center justify-center">
              <Database className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">
              AI Query Builder
            </span>
          </div>

          <div className="flex items-center gap-6">
            <span className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
              Kebijakan Privasi
            </span>
            <span className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
              Syarat Layanan
            </span>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} SAMSAT Kalimantan Selatan
          </p>
        </div>
      </div>
    </footer>
  );
}
