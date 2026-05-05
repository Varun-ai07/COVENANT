"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import dynamic from "next/dynamic";
import {
  Network,
  BarChart3,
  Trophy,
  GitBranch,
  FileText,
  LayoutDashboard,
  ShoppingCart,
  ShieldAlert,
  Users,
  Layers,
  Menu,
  X,
  Play,
} from "lucide-react";
import { usePathname } from "next/navigation";

const AsymmetricBox = dynamic(() => import("@/components/ui/AsymmetricBox"), {
  ssr: false,
  loading: () => <div />,
});

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketplace", label: "Market", icon: ShoppingCart },
  { href: "/network", label: "Network", icon: GitBranch },
  { href: "/leaderboard", label: "Leaders", icon: Trophy },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/receipts", label: "Receipts", icon: FileText },
  { href: "/disputes", label: "Disputes", icon: ShieldAlert },
  { href: "/insurance", label: "Insurance", icon: ShieldAlert },
  { href: "/collectives", label: "Collectives", icon: Users },
  { href: "/batches", label: "Batches", icon: Layers },
  { href: "/demo", label: "Demo", icon: Play },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-void-void/80 backdrop-blur-xl border-b border-glass-border">
      {/* Diagonal accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-synapse-violet/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="transform -rotate-1 hover:rotate-0 transition-transform duration-300">
          <Link href="/" className="flex items-center gap-2 group">
            <span
              className="font-heading text-2xl font-bold text-plasma-pink group-hover:text-synapse-violet transition-colors"
              style={{ textShadow: "0 0 20px rgba(217, 70, 239, 0.4)" }}
            >
              COVENANT
            </span>
            <span className="font-mono text-[10px] text-biolum-cyan tracking-[0.2em] mt-1">
              NEURAL
            </span>
          </Link>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 transform rotate-1">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3 py-2 text-sm font-body transition-all duration-200 group flex items-center gap-1.5
                  ${isActive ? "text-synapse-violet" : "text-gray-300 hover:text-white"} ${i % 2 === 0 ? "translate-y-0.5" : "-translate-y-0.5"}`}
              >
                <Icon size={14} className={`${isActive ? "text-synapse-violet" : "text-synapse-violet/70 group-hover:text-synapse-violet"} transition-colors`} />
                <span className="animated-underline">{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-synapse-violet transform -rotate-1" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="transform rotate-1">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
              label="Connect"
            />
          </div>
          <button
            className="md:hidden text-gray-300 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-neural-dark/95 backdrop-blur-xl border-t border-glass-border animate-slide-down">
          <div className="px-6 py-4 space-y-1 transform -rotate-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all duration-200
                    ${isActive ? "text-synapse-violet bg-synapse-violet/10" : "text-gray-300 hover:text-white hover:bg-glass"}`}
                >
                  <Icon size={16} className={isActive ? "text-synapse-violet" : "text-synapse-violet/70"} />
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
