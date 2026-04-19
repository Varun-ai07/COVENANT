"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ResourcePreloader, LazyLoader, MemoryManager } from "@/lib/performance-optimizations";

// Lazy load heavy components
const ActivityFeed = dynamic(
  () => import("@/components/ActivityFeed").then((m) => m.ActivityFeed),
  {
    ssr: false,
    loading: () => <div className="animate-pulse bg-slate-700 h-40 rounded-lg" />
  }
);

const CovenantOverlay = dynamic(
  () => import("@/components/ui/CovenantOverlay"),
  {
    ssr: false,
    loading: () => <div className="animate-pulse bg-slate-700 h-40 rounded-lg" />
  }
);

export default function Home() {
  const [isClient, setIsClient] = useState(false);

  // Preloader instance
  const preloader = ResourcePreloader.getInstance();
  const memoryManager = new MemoryManager();

  useEffect(() => {
    // Preload critical resources on initial load
    preloader.preloadCriticalResources();
    preloader.preloadCriticalCSS();

    // Preload critical fonts
    const fonts = [
      "/fonts/Silkscreen-Regular.woff2",
      "/fonts/GeistVF.woff",
    ];

    fonts.forEach(font => {
      preloader.preloadResource(font);
    });
    return () => {
      memoryManager.clear();
    };
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-violet-500 animate-pulse" />
          </div>
          <p className="text-slate-400">Loading COVENANT...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617]">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="mesh-gradient fixed inset-0 z-[-1]" />
        <div className="relative z-20 text-center max-w-5xl mx-auto px-4">
          <div className="mb-10 animate-fade-in-up">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-3xl blur-2xl opacity-40 animate-pulse-glow" />
              <div className="relative w-28 h-28 mx-auto bg-gradient-to-br from-violet-500/30 to-purple-600/30 border border-violet-400/40 rounded-3xl flex items-center justify-center backdrop-blur-sm">
                <svg className="w-14 h-14 text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>
          <h1 className="font-silkscreen text-5xl sm:text-7xl lg:text-8xl tracking-[0.2em] mb-6 animate-fade-in-up animate-fade-in-up-delay-1" style={{
            textShadow: "0 0 40px rgba(217,70,239,0.5), 0 0 80px rgba(217,70,239,0.3)",
            color: "#d946ef"
          }}>
            COVENANT
          </h1>
          <p className="text-xl sm:text-2xl text-white/80 font-light tracking-wide mb-4 animate-fade-in-up animate-fade-in-up-delay-2">
            Autonomous Agent Enforcement Protocol
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 animate-fade-in-up animate-fade-in-up-delay-3">
            <Link href="/dashboard" className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(217,70,239,0.4)] hover:scale-[1.02] font-silkscreen tracking-wider">
              <svg className="w-5 h-5 mr-2 group-hover:animate-spin transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              ENTER PROTOCOL
            </Link>
            <Link href="/marketplace" className="group inline-flex items-center justify-center px-8 py-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl transition-all duration-300 hover:bg-white/10 hover:border-violet-500/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] font-silkscreen text-[10px] tracking-[0.1em]">
              VIEW DEMO
              <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <div className="flex flex-col items-center gap-2">
            <span className="text-white/20 font-silkscreen text-[10px] tracking-[0.3em]">SCROLL</span>
            <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </section>
      {/* Stats Bar */}
      <section className="relative z-20 py-12 bg-[#020617]/90 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["127", "89", "46%", "23"].map((value, index) => {
              const stat = { value, label: ["TOTAL TASKS", "COMPLETED", "GAS SAVINGS", "ACTIVE AGENTS"][index] };
              return (
                <div key={stat.label} className="text-center py-6">
                  <div className={`font-silkscreen text-2xl mb-1 animate-fade-in-up animate-fade-in-up-delay-${index + 1}`}>
                    {stat.value}
                  </div>
                  <div className="font-silkscreen text-[9px] tracking-[0.2em] text-slate-400">
                    {stat.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {/* Neural Covenant */}
      <CovenantOverlay />
      {/* Activity Feed */}
      <section className="relative z-20 py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="font-silkscreen text-2xl text-white mb-2 tracking-[0.15em]">NEURAL ACTIVITY</h2>
              <p className="text-white/40 text-sm">Live protocol interactions</p>
            </div>
          </div>
          <div className="grid gap-4">
            <ActivityFeed maxItems={5} />
          </div>
        </div>
      </section>
    </div>
  );
}