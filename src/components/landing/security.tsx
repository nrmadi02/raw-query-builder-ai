"use client";

import { motion } from "motion/react";
import { AnimatedSection, staggerContainer } from "./motion-wrapper";
import { ShieldCheck, Lock, Scan, Wifi } from "lucide-react";

const features = [
  {
    icon: ShieldCheck,
    title: "SQL Injection Prevention",
    description: "Setiap query divalidasi melalui AST parser untuk memastikan tidak ada serangan SQL injection.",
  },
  {
    icon: Lock,
    title: "Access Control",
    description: "Hanya pengguna yang terautentikasi melalui Google OAuth yang dapat mengakses sistem.",
  },
  {
    icon: Scan,
    title: "Validasi Konteks",
    description: "Pertanyaan yang tidak relevan dengan domain pajak kendaraan akan ditolak secara otomatis.",
  },
  {
    icon: Wifi,
    title: "Koneksi Terenkripsi",
    description: "Semua komunikasi data dilakukan melalui koneksi terenkripsi dan aman.",
  },
];

export function Security() {
  return (
    <section
      id="keamanan"
      className="py-24 bg-slate-900 dark:bg-slate-950 relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: "radial-gradient(circle at 25% 25%, rgba(255,255,255,0.1) 1px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 1px, transparent 1px)",
        backgroundSize: "50px 50px"
      }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            Keamanan Terjamin
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Data Anda{" "}
            <span className="text-emerald-400">
              Aman Bersama Kami
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Keamanan data adalah prioritas utama kami. Berbagai lapisan proteksi diterapkan untuk menjaga integritas dan kerahasiaan data.
          </p>
        </AnimatedSection>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={{
                hidden: { opacity: 0, scale: 0.8 },
                visible: { opacity: 1, scale: 1 },
              }}
              transition={{ duration: 0.5 }}
              whileHover={{ scale: 1.05, y: -5 }}
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300 text-center"
            >
              <motion.div
                className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5"
                whileHover={{ rotate: 5, scale: 1.1 }}
              >
                <feature.icon className="w-7 h-7 text-emerald-400" />
              </motion.div>
              <h3 className="font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
