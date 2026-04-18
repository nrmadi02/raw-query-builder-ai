"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { FloatingElement } from "./motion-wrapper";

export function CtaSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Animated gradient background */}
      <motion.div
        className="absolute inset-0 bg-linear-to-br from-teal-600 via-emerald-500 to-emerald-400"
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ backgroundSize: "200% 200%" }}
      />

      {/* Decorative floating elements */}
      <FloatingElement
        className="absolute top-10 right-20 w-40 h-40 bg-white/5 rounded-full blur-2xl"
        duration={5}
        distance={15}
      />
      <FloatingElement
        className="absolute bottom-10 left-20 w-56 h-56 bg-white/5 rounded-full blur-2xl"
        duration={7}
        distance={20}
      />
      <FloatingElement
        className="absolute top-1/2 left-1/2 w-32 h-32 bg-emerald-300/10 rounded-full blur-2xl"
        duration={6}
        distance={12}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
        >
          Siap Mengoptimalkan
          <br />
          Data SAMSAT Anda?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-lg text-white/80 mb-10 max-w-2xl mx-auto"
        >
          Mulai gunakan AI Query Builder sekarang dan rasakan kemudahan
          mengelola data pajak kendaraan bermotor.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link href="/login">
            <Button
              size="lg"
              className="h-14 px-10 text-base font-semibold bg-white text-emerald-700 hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all group"
            >
              Mulai Sekarang — Gratis
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
