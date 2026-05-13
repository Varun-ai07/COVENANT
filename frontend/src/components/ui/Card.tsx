"use client";

import { memo, forwardRef } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "interactive" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
}

const variantClasses = {
  default: "bg-surface border border-border",
  elevated: "bg-surface-alt border border-border shadow-elevated",
  interactive:
    "bg-surface border border-border hover:border-border-light hover:bg-surface-alt hover:shadow-glow-sm cursor-pointer transition-all duration-300",
  glass: "bg-surface/80 backdrop-blur-xl border border-border-light/60 shadow-elevated",
};

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
};

export const Card = memo(
  forwardRef<HTMLDivElement, CardProps>(function Card(
    { children, className, variant = "default", padding = "none", onClick },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl",
          variantClasses[variant],
          paddingClasses[padding],
          className
        )}
        onClick={onClick}
        {...(onClick ? { role: "button", tabIndex: 0 } : {})}
      >
        {children}
      </div>
    );
  })
);

/** @deprecated Use Card instead */
export const GlassCard = Card;