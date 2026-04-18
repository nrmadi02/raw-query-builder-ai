"use client";

import { motion } from "motion/react";
import { AnimatedSection, CountUp } from "./motion-wrapper";
import { Database, Zap, Brain, Shield } from "lucide-react";

const stats = [
  { icon: Database, value: 40, suffix: "+", label: "Tabel Data" },
  { icon: Zap, value: 3, suffix: " detik", label: "Rata-rata Response" },
  { icon: Brain, value: 100, suffix: "%", label: "AI-Powered Analysis" },
  { icon: Shield, value: 24, suffix: "/7", label: "Keamanan Terjamin" },
];

export function StatsBar() {
  return (
    <section className="relative py-16 bg-white dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="text-center group"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 mb-3 group-hover:scale-110 transition-transform">
                  <stat.icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-1">
                  <CountUp target={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
              </motion.div>
            ))}
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
