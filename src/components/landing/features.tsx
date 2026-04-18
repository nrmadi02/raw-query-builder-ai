"use client";

import { motion } from "motion/react";
import { AnimatedSection, staggerContainer } from "./motion-wrapper";
import {
  MessageSquareText,
  Layers,
  BarChart3,
  Sparkles,
  History,
  Code2,
  Download,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: MessageSquareText,
    title: "Natural Language to SQL",
    description:
      "Tanyakan dalam bahasa Indonesia, AI secara otomatis menghasilkan query SQL yang akurat.",
    gradient: "from-teal-500 to-emerald-500",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  {
    icon: BarChart3,
    title: "Visualisasi Data Otomatis",
    description:
      "Grafik bar, line, pie, dan area chart yang dihasilkan otomatis dari hasil query.",
    gradient: "from-emerald-500 to-green-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Sparkles,
    title: "AI Insights",
    description:
      "Analisis cerdas dan ringkasan otomatis dari data hasil query Anda.",
    gradient: "from-violet-500 to-purple-500",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: Layers,
    title: "Multi-Query Generation",
    description:
      "Hasilkan beberapa query dari berbagai perspektif dalam satu pertanyaan.",
    gradient: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    icon: Code2,
    title: "SQL Editor",
    description:
      "Edit dan jalankan ulang query SQL yang dihasilkan AI sesuai kebutuhan spesifik Anda.",
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    icon: History,
    title: "Riwayat Percakapan",
    description:
      "Semua percakapan tersimpan dan bisa diakses kembali kapan saja.",
    gradient: "from-rose-500 to-pink-500",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    icon: Download,
    title: "Export Data",
    description:
      "Unduh hasil query dalam format CSV atau Excel (XLSX) dengan satu klik.",
    gradient: "from-teal-500 to-cyan-500",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  {
    icon: ShieldCheck,
    title: "Keamanan Data",
    description:
      "Validasi SQL injection, validasi konteks, dan akses terkontrol untuk keamanan penuh.",
    gradient: "from-green-500 to-emerald-600",
    bg: "bg-green-50 dark:bg-green-950/40",
    iconColor: "text-green-600 dark:text-green-400",
  },
];

export function Features() {
  return (
    <section id="fitur" className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <span className="inline-block px-3 py-1 text-xs font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 rounded-full uppercase mb-4">
            Fitur Platform
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Fitur{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              Unggulan
            </span>
          </h2>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Semua yang Anda butuhkan untuk mengelola data pajak kendaraan dengan
            efisien
          </p>
          {/* Animated gradient underline */}
          <motion.div
            className="mx-auto mt-5 h-1 rounded-full bg-linear-to-r from-teal-600 via-emerald-500 to-emerald-400"
            initial={{ width: 0 }}
            whileInView={{ width: 96 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
        </AnimatedSection>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0 },
              }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.03, y: -5 }}
              className="group relative p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800 shadow-sm hover:shadow-xl transition-all duration-300 cursor-default"
            >
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl bg-linear-to-br from-emerald-500/4 to-teal-500/4 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10">
                {/* Icon container */}
                <div
                  className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>

                {/* Gradient tag line */}
                <div
                  className={`w-8 h-1 rounded-full bg-linear-to-r ${feature.gradient} mb-3 group-hover:w-12 transition-all duration-300`}
                />

                <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-sm leading-snug">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
