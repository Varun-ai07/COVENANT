"use client";

import { memo, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ButtonProps {
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
    "bg-accent text-background hover:bg-accent-hover border border-transparent",
  secondary:
    "bg-surface text-foreground border border-border hover:border-border-hover hover:bg-surface-alt",
  ghost:
    "bg-transparent text-muted border border-transparent hover:text-foreground hover:bg-surface",
  danger:
    "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-5 py-2.5 text-base gap-2",
  lg: "px-8 py-3 text-lg gap-2",
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
          "inline-flex items-center justify-center rounded-lg font-body font-medium",
          "transition-all duration-200",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
      >
        {loading && <Loader2 size={size === "sm" ? 14 : 16} className="animate-spin" />}
        {children}
      </button>
    );
  })
);

/** @deprecated Use Button instead */
export const NeonButton = Button;
