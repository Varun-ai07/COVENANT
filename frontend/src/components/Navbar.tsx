"use client";

import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "HOME" },
  { href: "/demo", label: "DEMO" },
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/marketplace", label: "MARKET" },
  { href: "/market", label: "OPEN MARKET" },
  { href: "/batches", label: "BATCHES" },
  { href: "/disputes", label: "DISPUTES" },
  { href: "/insurance", label: "INSURANCE" },
  { href: "/leaderboard", label: "RANKS" },
  { href: "/receipts", label: "RECEIPTS" },
  { href: "/stats", label: "STATS" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      {/* Glass background with gradient border bottom */}
      <div className="absolute inset-0 bg-[#0a0118]/60 backdrop-blur-2xl" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500/40 rounded-lg blur-md group-hover:bg-fuchsia-500/40 transition-colors duration-500" />
              <div className="relative w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <span
              className="font-silkscreen text-sm tracking-[0.2em] hidden sm:block"
              style={{ color: "#d946ef", textShadow: "0 0 20px rgba(217,70,239,0.4)" }}
            >
              COVENANT
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 font-silkscreen text-[10px] tracking-[0.15em] transition-all duration-300 ${
                    isActive
                      ? "text-white"
                      : "text-white/30 hover:text-white/70"
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-white/[0.04] rounded-md border border-violet-500/20" />
                  )}
                  <span className="relative z-10">{item.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-violet-400 rounded-full" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Wallet Connect + Mobile Menu */}
          <div className="flex items-center gap-2">
            <ConnectButton
              accountStatus="avatar"
              chainStatus="icon"
              showBalance={false}
            />

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden relative animate-slide-down">
          <div className="absolute inset-0 bg-[#0a0118]/95 backdrop-blur-2xl" />
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          <div className="relative px-4 py-3 space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md font-silkscreen text-[10px] tracking-[0.15em] transition-colors ${
                    isActive
                      ? "bg-white/[0.04] text-white border border-violet-500/20"
                      : "text-white/30 hover:text-white/60 hover:bg-white/[0.02]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
