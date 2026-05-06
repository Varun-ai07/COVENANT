"use client";

import { memo, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
  onClick?: () => void;
}

const variantClasses = {
  default: "bg-surface border border-border",
  elevated: "bg-surface-alt border border-border",
  interactive:
    "bg-surface border border-border hover:border-border-hover hover:bg-surface-alt cursor-pointer transition-all duration-200",
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
          "rounded-xl",
          variantClasses[variant],
          paddingClasses[padding],
          className
        )}
        onClick={onClick}
      >
        {children}
      </div>
    );
  })
);

/** @deprecated Use Card instead */
export const GlassCard = Card;
