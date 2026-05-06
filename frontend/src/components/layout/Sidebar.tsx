"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  ShoppingCart,
  GitBranch,
  Trophy,
  BarChart3,
  FileText,
  ShieldAlert,
  Users,
  Layers,
  Play,
  TrendingUp,
  Activity,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/marketplace", label: "Marketplace", icon: ShoppingCart },
    ],
  },
  {
    label: "Protocol",
    items: [
      { href: "/network", label: "Network", icon: GitBranch },
      { href: "/receipts", label: "Receipts", icon: FileText },
      { href: "/verifier", label: "Verifier", icon: ShieldAlert },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/insurance", label: "Insurance", icon: ShieldAlert },
      { href: "/collectives", label: "Collectives", icon: Users },
      { href: "/batches", label: "Batches", icon: Layers },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/disputes", label: "Disputes", icon: ShieldAlert },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
      { href: "/stats", label: "Stats", icon: TrendingUp },
    ],
  },
  {
    label: "Learn",
    items: [
      { href: "/demo", label: "Demo", icon: Play },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Collapse toggle (desktop only) */}
      <div className="hidden lg:flex items-center justify-end px-3 py-2">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-alt transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-wider text-muted/60">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg transition-all duration-150 group relative",
                      collapsed
                        ? "justify-center px-2 py-2.5"
                        : "px-3 py-2",
                      isActive
                        ? "text-accent bg-accent-muted"
                        : "text-muted hover:text-foreground hover:bg-surface-alt"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-accent rounded-r-full" />
                    )}
                    <Icon
                      size={18}
                      className={cn(
                        "flex-shrink-0 transition-colors",
                        isActive
                          ? "text-accent"
                          : "text-muted group-hover:text-foreground"
                      )}
                    />
                    {!collapsed && (
                      <span className="text-sm font-body truncate">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: protocol version */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-border">
          <p className="text-[10px] font-mono text-muted/40">
            COVENANT v2.0 · Base Sepolia
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-14 bottom-0 z-40 bg-surface border-r border-border transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-14 bottom-0 z-50 w-56 bg-surface border-r border-border lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
