"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FiatOnRamp } from "@/components/onramp/FiatOnRamp";

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-surface/80 backdrop-blur-xl border-b border-border">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface-alt transition-colors lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu size={18} />
          </button>
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-heading text-lg font-bold text-foreground group-hover:text-accent transition-colors tracking-tight">
              COVENANT
            </span>
            <span className="hidden sm:inline font-mono text-[9px] text-muted tracking-widest uppercase mt-0.5">
              Protocol
            </span>
          </Link>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <FiatOnRamp />
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="avatar"
            label="Connect"
          />
        </div>
      </div>
    </header>
  );
}
