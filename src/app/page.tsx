import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { StatsBar } from "@/components/landing/stats-bar";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { ExampleQueries } from "@/components/landing/example-queries";
import { Security } from "@/components/landing/security";
import { CtaSection } from "@/components/landing/cta-section";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-white dark:bg-slate-950">
      <Navbar />
      <Hero />
      <StatsBar />
      <Features />
      <HowItWorks />
      <ExampleQueries />
      <Security />
      <CtaSection />
      <Footer />
    </main>
  );
}
