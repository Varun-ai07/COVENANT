"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string | number;
  size?: "sm" | "md";
  variant?: "default" | "dot";
}

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  0: { label: "Created", color: "text-muted bg-muted/10 border-muted/30", icon: "○" },
  1: { label: "Funded", color: "text-info bg-info/10 border-info/30", icon: "◉" },
  2: { label: "In Progress", color: "text-accent-light bg-accent/10 border-accent/30", icon: "◐" },
  3: { label: "Submitted", color: "text-warning bg-warning/10 border-warning/30", icon: "◉" },
  4: { label: "Completed", color: "text-success bg-success/10 border-success/30", icon: "✓" },
  5: { label: "Failed", color: "text-danger bg-danger/10 border-danger/30", icon: "✗" },
  6: { label: "Disputed", color: "text-warning bg-warning/10 border-warning/30", icon: "⚡" },
  open: { label: "Open", color: "text-info bg-info/10 border-info/30", icon: "◎" },
  in_progress: { label: "In Progress", color: "text-accent-light bg-accent/10 border-accent/30", icon: "◐" },
  completed: { label: "Completed", color: "text-success bg-success/10 border-success/30", icon: "✓" },
  failed: { label: "Failed", color: "text-danger bg-danger/10 border-danger/30", icon: "✗" },
  disputed: { label: "Disputed", color: "text-warning bg-warning/10 border-warning/30", icon: "⚡" },
  cancelled: { label: "Cancelled", color: "text-muted bg-muted/10 border-muted/30", icon: "⊘" },
};

export const StatusBadge = memo(function StatusBadge({
  status,
  size = "md",
  variant = "default",
}: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig[0];

  if (variant === "dot") {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-mono",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        config.color
      )}>
        <span className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "completed" || status === 4 ? "bg-success" :
          status === "in_progress" || status === 2 ? "bg-accent-light" :
          status === "failed" || status === 5 ? "bg-danger" :
          "bg-muted"
        )} />
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border font-mono font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        "rounded-full",
        config.color
      )}
    >
      <span className="text-sm leading-none">{config.icon}</span>
      {config.label}
    </span>
  );
});