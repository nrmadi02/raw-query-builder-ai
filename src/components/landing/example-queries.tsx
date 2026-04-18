"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AnimatedSection } from "./motion-wrapper";
import { MessageSquare, Code2, BarChart3 } from "lucide-react";

interface Example {
  question: string;
  sql: string;
  chartType: string;
  chartData: { label: string; value: number }[];
}

const examples: Example[] = [
  {
    question: "Tampilkan 10 kendaraan dengan pajak tertinggi di Banjarmasin",
    sql: `SELECT v.no_polisi, v.merk, p.total_pkb\nFROM kendaraan v\nJOIN pajak p ON v.id = p.kendaraan_id\nWHERE v.kode_wilayah = 'DA'\nORDER BY p.total_pkb DESC\nLIMIT 10`,
    chartType: "Bar Chart",
    chartData: [
      { label: "DA 1234 AB", value: 85 },
      { label: "DA 5678 CD", value: 72 },
      { label: "DA 9012 EF", value: 65 },
      { label: "DA 3456 GH", value: 58 },
      { label: "DA 7890 IJ", value: 45 },
    ],
  },
  {
    question: "Berapa total pendapatan PKB bulan ini per kecamatan",
    sql: `SELECT k.nama_kecamatan, SUM(p.total_pkb) as total\nFROM pembayaran p\nJOIN kecamatan k ON p.kecamatan_id = k.id\nWHERE p.tanggal >= DATE_TRUNC('month', CURRENT_DATE)\nGROUP BY k.nama_kecamatan\nORDER BY total DESC`,
    chartType: "Pie Chart",
    chartData: [
      { label: "Banjarmasin Barat", value: 35 },
      { label: "Banjarmasin Selatan", value: 25 },
      { label: "Banjarmasin Tengah", value: 20 },
      { label: "Banjarmasin Timur", value: 12 },
      { label: "Banjarmasin Utara", value: 8 },
    ],
  },
  {
    question: "Bandingkan jumlah transaksi per channel pembayaran tahun ini",
    sql: `SELECT channel, COUNT(*) as jumlah\nFROM pembayaran\nWHERE EXTRACT(YEAR FROM tanggal) = EXTRACT(YEAR FROM CURRENT_DATE)\nGROUP BY channel\nORDER BY jumlah DESC`,
    chartType: "Line Chart",
    chartData: [
      { label: "Loket", value: 45 },
      { label: "Bank", value: 30 },
      { label: "Online", value: 15 },
      { label: "Mobile", value: 10 },
    ],
  },
];

export function ExampleQueries() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = examples[activeIndex];
  const maxValue = Math.max(...active.chartData.map((d) => d.value));

  return (
    <section className="py-24 bg-slate-50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Contoh{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              Pertanyaan
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Lihat bagaimana AI Query Builder mengubah pertanyaan sehari-hari
            menjadi data bermakna
          </p>
        </AnimatedSection>

        {/* Tab selector */}
        <AnimatedSection className="flex flex-wrap justify-center gap-3 mb-12">
          {examples.map((ex, i) => (
            <motion.button
              key={i}
              onClick={() => setActiveIndex(i)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all max-w-xs truncate ${
                i === activeIndex
                  ? "bg-linear-to-r from-teal-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700"
              }`}
            >
              {ex.question}
            </motion.button>
          ))}
        </AnimatedSection>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="grid md:grid-cols-2 gap-6"
          >
            {/* SQL Preview */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <Code2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Generated SQL
                </span>
              </div>
              <div className="p-4">
                <pre className="text-sm font-mono text-slate-700 dark:text-slate-300 leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {active.sql}
                </pre>
              </div>
            </div>

            {/* Chart Preview */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {active.chartType} Preview
                </span>
              </div>
              <div className="p-5 space-y-3">
                {active.chartData.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-32 truncate shrink-0">
                      {item.label}
                    </span>
                    <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.value / maxValue) * 100}%` }}
                        transition={{
                          delay: 0.3 + i * 0.1,
                          duration: 0.6,
                          ease: "easeOut",
                        }}
                        className="h-full bg-linear-to-r from-teal-500 to-emerald-400 rounded-lg"
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right">
                      {item.value}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
