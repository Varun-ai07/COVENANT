"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const ActivityFeed = dynamic(
  () => import("@/components/ActivityFeed").then((m) => m.ActivityFeed),
  { ssr: false }
);

const CovenantOverlay = dynamic(
  () => import("@/components/ui/CovenantOverlay"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden">
        <div className="relative z-20 text-center max-w-5xl mx-auto px-4">
          {/* Shield Logo */}
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

          {/* Title — Silkscreen font */}
          <h1
            className="font-silkscreen text-5xl sm:text-7xl lg:text-8xl tracking-[0.2em] mb-6 animate-fade-in-up animate-fade-in-up-delay-1"
            style={{
              textShadow: "0 0 40px rgba(217,70,239,0.5), 0 0 80px rgba(217,70,239,0.3)",
              color: "#d946ef",
            }}
          >
            COVENANT
          </h1>

          {/* Tagline */}
          <p className="text-xl sm:text-2xl text-white/80 font-light tracking-wide mb-4 animate-fade-in-up animate-fade-in-up-delay-2">
            Autonomous Agent Enforcement Protocol
          </p>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-white/40 max-w-xl mx-auto mb-14 animate-fade-in-up animate-fade-in-up-delay-3 font-silkscreen tracking-wider">
            AGENTS NEGOTIATE. SMART CONTRACTS ENFORCE. ON CHAIN.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8 animate-fade-in-up animate-fade-in-up-delay-4">
            <Link
              href="/dashboard"
              className="group relative inline-flex items-center justify-center px-10 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(217,70,239,0.4)] hover:scale-[1.02] font-silkscreen tracking-wider"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              ENTER PROTOCOL
            </Link>
            <Link
              href="/demo"
              className="group inline-flex items-center justify-center px-10 py-4 bg-white/5 border border-white/20 text-white font-semibold rounded-xl transition-all duration-300 hover:bg-white/10 hover:border-violet-500/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] font-silkscreen tracking-wider"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              VIEW DEMO
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
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
      <section className="relative z-20 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "3", label: "SMART CONTRACTS", color: "text-violet-400" },
              { value: "ERC-8004", label: "COMPLIANT", color: "text-fuchsia-400" },
              { value: "BASE", label: "L2 NETWORK", color: "text-emerald-400" },
              { value: "0", label: "MIDDLEMEN", color: "text-amber-400" },
            ].map((stat, i) => (
              <div key={i} className="glass-card p-5 text-center backdrop-blur-xl">
                <div className={`font-silkscreen text-2xl sm:text-3xl mb-1 ${stat.color}`}>
                  {stat.value}
                </div>
                <div className="font-silkscreen text-[9px] tracking-[0.2em] text-white/30">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Neural Covenant — Hex.tech Bento Grid */}
      <CovenantOverlay />

      {/* Activity Feed */}
      <section className="relative z-20 py-16">
        <div className="max-w-3xl mx-auto px-4">
          <ActivityFeed maxItems={5} />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-20 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="font-silkscreen text-xs tracking-[0.3em] text-white/20 mb-4">
            COVENANT PROTOCOL
          </div>
          <p className="text-white/30 text-xs mb-2">
            Built for Synthesis Hackathon | Powered by Base L2 | ERC-8004 Compliant
          </p>
          <a
            href="https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400/60 hover:text-violet-400 text-xs transition-colors"
          >
            Get free Base Sepolia testnet ETH →
          </a>
        </div>
      </footer>
    </div>
  );
}
