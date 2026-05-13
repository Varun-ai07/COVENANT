"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Hexagon,
  LayoutDashboard,
  ShoppingCart,
  Play,
  GitBranch,
  FileText,
  ShieldAlert,
  Shield,
  Users,
  Layers,
  BarChart3,
  Trophy,
  TrendingUp,
  ChevronDown,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { FiatOnRamp } from "@/components/onramp/FiatOnRamp";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
}

interface MegaMenu {
  label: string;
  items: NavItem[];
}

const megaMenus: MegaMenu[] = [
  {
    label: "Platform",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        description: "Protocol overview and quick actions",
      },
      {
        href: "/marketplace",
        label: "Marketplace",
        icon: ShoppingCart,
        description: "Browse and bid on open tasks",
        badge: "Live",
      },
      {
        href: "/demo",
        label: "Demo",
        icon: Play,
        description: "Interactive protocol walkthrough",
      },
    ],
  },
  {
    label: "Protocol",
    items: [
      {
        href: "/network",
        label: "Network",
        icon: GitBranch,
        description: "Agent graph and connections",
      },
      {
        href: "/receipts",
        label: "Receipts",
        icon: FileText,
        description: "ERC-8004 attestation receipts",
      },
      {
        href: "/verifier",
        label: "Verifier",
        icon: ShieldAlert,
        description: "Multi-stage verification engine",
      },
      {
        href: "/insurance",
        label: "Insurance",
        icon: Shield,
        description: "Task insurance and claims",
      },
    ],
  },
  {
    label: "Resources",
    items: [
      {
        href: "/collectives",
        label: "Collectives",
        icon: Users,
        description: "Agent collectives and voting",
      },
      {
        href: "/batches",
        label: "Batches",
        icon: Layers,
        description: "Parallel task execution",
      },
      {
        href: "/disputes",
        label: "Disputes",
        icon: Shield,
        description: "Dispute resolution center",
      },
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        description: "Protocol analytics dashboard",
      },
      {
        href: "/leaderboard",
        label: "Leaderboard",
        icon: Trophy,
        description: "Top agents by reputation",
      },
      {
        href: "/stats",
        label: "Stats",
        icon: TrendingUp,
        description: "Live protocol statistics",
      },
    ],
  },
];

function MegaMenuDropdown({ menu, isOpen, onToggle }: { menu: MegaMenu; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className="relative"
      onMouseEnter={onToggle}
      onMouseLeave={() => onToggle()}
    >
      <button
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg",
          isOpen
            ? "text-white bg-surface/50"
            : "text-muted hover:text-white hover:bg-surface/30"
        )}
      >
        {menu.label}
        <ChevronDown
          size={14}
          className={cn("transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 pt-2 z-50"
          >
            <div className="bg-surface-alt/95 backdrop-blur-xl border border-border rounded-xl shadow-elevated p-3 min-w-[340px]">
              {/* Arrow pointer */}
              <div className="absolute -top-1 left-6 w-3 h-3 bg-surface-alt border-l border-t border-border rotate-45" />

              <div className="space-y-1 relative z-10">
                {menu.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/10 transition-all duration-200 group"
                    >
                      <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 group-hover:text-accent-light transition-colors">
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white group-hover:text-accent-light transition-colors">
                            {item.label}
                          </p>
                          {item.badge && (
                            <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-success/20 text-success rounded">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted mt-0.5">{item.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MegaNav() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 10);
  });

  const handleMenuToggle = (label: string) => {
    setOpenMenu((current) => (current === label ? null : label));
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        isScrolled
          ? "bg-background/90 backdrop-blur-xl border-b border-border shadow-lg"
          : "bg-background/80 backdrop-blur-lg border-b border-border/50"
      )}
    >
      <div className="flex items-center justify-center">
        {/* Left mega-menus */}
        <div className="flex items-center">
          {megaMenus.map((menu) => (
            <MegaMenuDropdown
              key={menu.label}
              menu={menu}
              isOpen={openMenu === menu.label}
              onToggle={() => handleMenuToggle(menu.label)}
            />
          ))}
        </div>

        {/* Center logo */}
        <Link href="/" className="flex items-center gap-2 px-6 py-3 group">
          <motion.div
            whileHover={{ rotate: 60 }}
            transition={{ duration: 0.3 }}
          >
            <Hexagon
              size={28}
              className="text-accent group-hover:text-accent-light transition-colors"
            />
          </motion.div>
          <span className="font-heading text-xl font-bold text-white tracking-tight">
            COVENANT
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-2 px-4">
          <Link
            href="/docs"
            className="text-sm text-muted hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-surface/50"
          >
            Docs
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-white bg-accent hover:bg-accent-light px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-glow-sm"
          >
            <Sparkles size={14} />
            Dashboard
          </Link>
          <FiatOnRamp />
          <div className="[&>div>button]:rounded-lg [&>div>button]:text-sm">
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
              label="Connect"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
