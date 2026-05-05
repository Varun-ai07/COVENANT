"use client";

import { memo } from "react";
import dynamic from "next/dynamic";

const AsymmetricBox = dynamic(() => import("@/components/ui/AsymmetricBox"), { ssr: false });

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: "violet" | "pink" | "cyan" | "gold";
  asymmetric?: boolean;
  breathe?: boolean;
  onClick?: () => void;
}

const glowMap = {
  violet: "shadow-glow-violet",
  pink: "shadow-glow-pink",
  cyan: "shadow-glow-cyan",
  gold: "shadow-glow-gold",
};

export const GlassCard = memo(function GlassCard({
  children,
  className = "",
  glowColor = "violet",
  asymmetric = false,
  breathe = false,
  onClick,
}: GlassCardProps) {
  const baseClass = "relative bg-glass backdrop-blur-lg border border-glass-border rounded-2xl transition-all duration-500 hover:bg-glass-hover";
  const glowClass = glowMap[glowColor];
  const breatheClass = breathe ? "animate-breathe" : "";
  const cursorClass = onClick ? "cursor-pointer" : "";

  return (
    <div
      className={`${asymmetric ? "rounded-neural" : "rounded-2xl"} ${baseClass} ${glowClass} ${breatheClass} ${cursorClass} ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(13,2,33,0.7) 0%, rgba(10,1,24,0.9) 100%)",
      }}
      onClick={onClick}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mouse-x", `${((e.clientX - rect.left) / rect.width) * 100}%`);
        e.currentTarget.style.setProperty("--mouse-y", `${((e.clientY - rect.top) / rect.height) * 100}%`);
      }}
    >
      {/* Inner glow following mouse */}
      <div className="card-inner-glow absolute inset-0 rounded-2xl pointer-events-none" />
      {children}
    </div>
  );
});
