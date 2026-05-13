"use client";

import { memo, forwardRef } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const variantClasses = {
  primary:
    "bg-accent text-white hover:bg-accent-light border border-transparent shadow-glow-sm hover:shadow-glow active:scale-[0.98]",
  secondary:
    "bg-surface text-foreground border border-border hover:border-border-light hover:bg-surface-alt hover:shadow-glow-sm",
  ghost:
    "bg-transparent text-muted border border-transparent hover:text-foreground hover:bg-surface/50",
  danger:
    "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20",
  outline:
    "bg-transparent text-white border border-border hover:border-border-light/60 hover:bg-white/5 hover:shadow-glow-sm",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-base gap-2",
  lg: "px-8 py-3 text-lg gap-2.5",
};

export const Button = memo(
  forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
      children,
      onClick,
      variant = "primary",
      size = "md",
      loading = false,
      disabled = false,
      className,
      type = "button",
      icon,
      iconPosition = "left",
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-body font-semibold",
          "transition-all duration-200 ease-out",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
      >
        {loading && (
          <Loader2
            size={size === "sm" ? 14 : 16}
            className={cn(
              "animate-spin shrink-0",
              iconPosition === "left" ? "mr-2" : "ml-2"
            )}
          />
        )}
        {!loading && icon && iconPosition === "left" && (
          <span className="shrink-0">{icon}</span>
        )}
        {children}
        {!loading && icon && iconPosition === "right" && (
          <span className="shrink-0">{icon}</span>
        )}
      </button>
    );
  })
);

/** @deprecated Use Button instead */
export const NeonButton = Button;