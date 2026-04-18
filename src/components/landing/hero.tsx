"use client";

import Link from "next/link";
import { Sparkles, ArrowRight, Terminal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { FloatingElement } from "./motion-wrapper";
import { useState, useEffect } from "react";

const heroWords = ["Data", "Keputusan", "Wawasan"];

export function Hero() {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % heroWords.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background: light = clean white gradient, dark = deep navy */}
      <div className="absolute inset-0 bg-linear-to-br from-slate-50 via-white to-teal-50/40 dark:bg-none dark:bg-[#0A1628]" />

      {/* Radial glow — top center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-radial from-teal-300/25 via-emerald-200/10 to-transparent dark:from-teal-500/20 dark:via-emerald-600/10 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Bottom accent glow */}
      <div className="absolute bottom-0 right-0 w-[600px] h-[400px] bg-radial from-teal-200/20 to-transparent dark:from-teal-400/15 dark:to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Animated blob left */}
      <FloatingElement
        className="absolute top-1/4 -left-20 w-80 h-80 bg-teal-200/25 dark:bg-teal-500/10 rounded-full blur-3xl"
        duration={7}
        distance={25}
      />
      {/* Animated blob right */}
      <FloatingElement
        className="absolute bottom-1/3 -right-20 w-96 h-96 bg-emerald-200/20 dark:bg-emerald-500/10 rounded-full blur-3xl"
        duration={9}
        distance={20}
      />

      {/* Fine grid overlay — light mode uses dark lines */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.5) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />
      {/* Fine grid overlay — dark mode uses light lines */}
      <div
        className="absolute inset-0 opacity-[0.04] hidden dark:block"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-24 pb-12">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-700 dark:text-teal-300 text-sm font-medium mb-8"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Powered by AI — SAMSAT Kalimantan Selatan
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 dark:text-white leading-[1.1] tracking-tight mb-6"
        >
          Ubah Pertanyaan
          <br />
          Menjadi{" "}
          <span className="relative inline-block min-w-[200px] lg:min-w-[320px]">
            <AnimatePresence mode="wait">
              <motion.span
                key={heroWords[wordIndex]}
                initial={{ opacity: 0, y: 20, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(6px)" }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
                className="inline-block bg-linear-to-r from-teal-600 via-emerald-500 to-teal-600 dark:from-teal-400 dark:via-emerald-300 dark:to-teal-400 bg-clip-text text-transparent"
              >
                {heroWords[wordIndex]}
              </motion.span>
            </AnimatePresence>
            <span className="absolute -bottom-2 left-0 right-0 h-[3px] rounded-full bg-linear-to-r from-teal-500 via-emerald-400 to-teal-500 opacity-60" />
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Buat query SQL secara otomatis dari bahasa Indonesia. Hemat waktu,
          tingkatkan produktivitas pengelolaan data pajak kendaraan.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link href="/login">
            <Button
              size="lg"
              className="h-12 px-8 text-base font-semibold bg-linear-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white shadow-xl shadow-teal-500/25 hover:shadow-teal-500/40 transition-all group border-0"
            >
              Mulai Sekarang
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <a href="#cara-kerja">
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base font-semibold border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-teal-400 dark:hover:border-teal-500 hover:text-teal-700 dark:hover:text-teal-300 transition-all"
            >
              Lihat Cara Kerja
            </Button>
          </a>
        </motion.div>

        {/* Mock query preview card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.9,
            delay: 0.85,
            ease: [0.25, 0.4, 0.25, 1],
          }}
          className="max-w-2xl mx-auto"
        >
          <div className="relative rounded-2xl p-px bg-linear-to-br from-teal-300 dark:from-teal-500/40 via-slate-200 dark:via-slate-700/20 to-emerald-300 dark:to-emerald-500/30 shadow-2xl dark:shadow-teal-500/10">
            <div className="bg-white dark:bg-[#0D1F35]/90 backdrop-blur-md rounded-2xl overflow-hidden border border-slate-100 dark:border-0">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-white/6 bg-slate-50/80 dark:bg-white/3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs ml-2">
                  <Terminal className="w-3 h-3" />
                  <span>AI Query Builder</span>
                </div>
              </div>
              {/* Terminal content */}
              <div className="p-5 text-left font-mono text-sm space-y-3">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-teal-500 dark:text-teal-400 select-none">
                    ❯
                  </span>
                  <span className="text-slate-700 dark:text-slate-200">
                    Tampilkan 10 kendaraan dengan pajak tertinggi di Banjarmasin
                  </span>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.9, duration: 0.5 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-teal-400/50 dark:text-teal-400/50 select-none">
                    {" "}
                    ↳
                  </span>
                  <div className="text-xs leading-relaxed">
                    <span className="text-blue-600 dark:text-slate-500">
                      SELECT
                    </span>{" "}
                    <span className="text-slate-600 dark:text-emerald-300/80">
                      v.no_polisi, v.merk, v.type_kendaraan, p.total_pkb
                    </span>
                    {"\n"}
                    <span className="text-blue-600 dark:text-slate-500">
                      FROM
                    </span>{" "}
                    <span className="text-slate-600 dark:text-emerald-300/80">
                      kendaraan v
                    </span>
                    {"\n"}
                    <span className="text-blue-600 dark:text-slate-500">
                      JOIN
                    </span>{" "}
                    <span className="text-slate-600 dark:text-emerald-300/80">
                      pajak p{" "}
                    </span>
                    <span className="text-blue-600 dark:text-slate-500">
                      ON
                    </span>{" "}
                    <span className="text-slate-600 dark:text-emerald-300/80">
                      v.id = p.kendaraan_id
                    </span>
                    {"\n"}
                    <span className="text-blue-600 dark:text-slate-500">
                      WHERE
                    </span>{" "}
                    <span className="text-slate-600 dark:text-emerald-300/80">
                      v.kode_wilayah ={" "}
                    </span>
                    <span className="text-amber-600 dark:text-amber-300">
                      &apos;DA&apos;
                    </span>
                    {"\n"}
                    <span className="text-blue-600 dark:text-slate-500">
                      ORDER BY
                    </span>{" "}
                    <span className="text-slate-600 dark:text-emerald-300/80">
                      p.total_pkb{" "}
                    </span>
                    <span className="text-blue-600 dark:text-slate-500">
                      DESC
                    </span>
                    {"\n"}
                    <span className="text-blue-600 dark:text-slate-500">
                      LIMIT
                    </span>{" "}
                    <span className="text-amber-600 dark:text-amber-300">
                      10
                    </span>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.2 }}
          className="mt-10 flex flex-col items-center gap-1 text-slate-400 dark:text-slate-500"
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade — blends into StatsBar */}
      <div className="absolute bottom-0 left-0 right-0 h-56 bg-linear-to-t from-white dark:from-slate-950 via-white/80 dark:via-slate-950/70 to-transparent pointer-events-none" />
    </section>
  );
}
