"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { AnimatedSection } from "./motion-wrapper";
import { MessageSquare, Cpu, BarChart3 } from "lucide-react";
import { useRef, type RefObject } from "react";

const steps = [
  {
    icon: MessageSquare,
    number: "01",
    title: "Tanya",
    description:
      'Ketik pertanyaan dalam bahasa Indonesia tentang data pajak kendaraan. Misalnya, "Tampilkan total pendapatan PKB per kecamatan bulan ini".',
    color: "from-teal-500 to-teal-600",
    bgLight: "bg-teal-50",
    bgDark: "dark:bg-teal-950/30",
  },
  {
    icon: Cpu,
    number: "02",
    title: "Proses",
    description:
      "AI memvalidasi pertanyaan, memilih tabel yang relevan, dan menghasilkan query SQL yang aman dan teroptimasi secara otomatis.",
    color: "from-emerald-500 to-emerald-600",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-950/30",
  },
  {
    icon: BarChart3,
    number: "03",
    title: "Hasil",
    description:
      "Lihat data dalam bentuk tabel interaktif, grafik visual, dan dapatkan analisis AI yang memberikan wawasan mendalam.",
    color: "from-green-500 to-green-600",
    bgLight: "bg-green-50",
    bgDark: "dark:bg-green-950/30",
  },
];

function ScrollLine({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });
  const lineHeight = useTransform(scrollYProgress, [0.1, 0.8], ["0%", "100%"]);

  return (
    <motion.div
      className="absolute top-0 left-0 w-full bg-linear-to-b from-teal-500 via-emerald-500 to-green-500 origin-top"
      style={{ height: lineHeight }}
    />
  );
}

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <section
      id="cara-kerja"
      ref={containerRef}
      className="py-24 bg-white dark:bg-slate-950 relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-20">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Cara{" "}
            <span className="text-emerald-600 dark:text-emerald-400">
              Kerja
            </span>
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Tiga langkah sederhana untuk mendapatkan data yang Anda butuhkan
          </p>
        </AnimatedSection>

        {/* Steps */}
        <div className="relative max-w-4xl mx-auto">
          {/* Connecting line (desktop) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
            <div className="w-full h-full bg-slate-200 dark:bg-slate-800" />
            <ScrollLine containerRef={containerRef} />
          </div>

          <div className="space-y-12 lg:space-y-24">
            {steps.map((step, i) => (
              <AnimatedSection
                key={step.number}
                variant={
                  i % 2 === 0
                    ? {
                        hidden: { opacity: 0, y: -40 },
                        visible: { opacity: 1, y: 0 },
                      }
                    : {
                        hidden: { opacity: 0, y: -40 },
                        visible: { opacity: 1, y: 0 },
                      }
                }
                delay={i * 0.15}
                className={`relative lg:grid lg:grid-cols-2 lg:gap-16 items-center ${
                  i % 2 !== 0 ? "lg:direction-rtl" : ""
                }`}
              >
                {/* Timeline dot (desktop) */}
                <div className="hidden lg:flex absolute left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-linear-to-br from-teal-600 to-emerald-500 items-center justify-center shadow-lg shadow-emerald-500/20 z-10">
                  <span className="text-white font-bold text-sm">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <div
                  className={`${i % 2 !== 0 ? "lg:col-start-2 lg:text-left" : "lg:text-right"} mb-6 lg:mb-0`}
                >
                  <div
                    className={`${i % 2 !== 0 ? "" : "lg:ml-auto"} max-w-md ${i % 2 !== 0 ? "" : "lg:text-right"}`}
                  >
                    <div
                      className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl ${step.bgLight} ${step.bgDark} mb-4`}
                    >
                      <step.icon className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                      {step.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {/* Visual placeholder */}
                <div
                  className={`${i % 2 !== 0 ? "lg:col-start-1 lg:row-start-1" : ""}`}
                >
                  <motion.div
                    whileHover={{ scale: 1.03 }}
                    className={`rounded-2xl p-8 ${step.bgLight} ${step.bgDark} border border-slate-200/50 dark:border-slate-800/50`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-8 h-8 rounded-lg bg-linear-to-br ${step.color} flex items-center justify-center`}
                      >
                        <step.icon className="w-4 h-4 text-white" />
                      </div>
                      <div className="h-2 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div className="h-2 w-4/5 rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div className="h-2 w-3/5 rounded-full bg-slate-200 dark:bg-slate-700" />
                    </div>
                  </motion.div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
