"use client";

import { memo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const variantClasses = {
  primary:
    "bg-synapse-violet/20 text-synapse-violet border-synapse-violet/50 hover:bg-synapse-violet/30 hover:shadow-glow-violet",
  secondary:
    "bg-plasma-pink/20 text-plasma-pink border-plasma-pink/50 hover:bg-plasma-pink/30 hover:shadow-glow-pink",
  ghost:
    "bg-transparent text-gray-300 border-glass-border hover:bg-glass hover:text-white",
  danger:
    "bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-base",
  lg: "px-8 py-3 text-lg",
};

export const NeonButton = memo(function NeonButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  type = "button",
}: NeonButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-xl font-body font-medium",
        "border transition-all duration-300 btn-glow",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
});
