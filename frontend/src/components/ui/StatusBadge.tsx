"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Play,
  FileCheck,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { TaskStatus } from "@/types";

interface StatusBadgeProps {
  status: TaskStatus | "open" | "in_progress" | "completed" | "failed" | "disputed" | "cancelled";
  size?: "sm" | "md";
}

const statusConfig = {
  0: { label: "Created", color: "text-muted bg-muted/10 border-muted/30", icon: Clock },
  1: { label: "Funded", color: "text-info bg-info/10 border-info/30", icon: CheckCircle2 },
  2: { label: "In Progress", color: "text-accent bg-accent/10 border-accent/30", icon: Play },
  3: { label: "Submitted", color: "text-warning bg-warning/10 border-warning/30", icon: FileCheck },
  4: { label: "Completed", color: "text-success bg-success/10 border-success/30", icon: CheckCircle2 },
  5: { label: "Failed", color: "text-danger bg-danger/10 border-danger/30", icon: XCircle },
  6: { label: "Disputed", color: "text-warning bg-warning/10 border-warning/30", icon: AlertTriangle },
  open: { label: "Open", color: "text-info bg-info/10 border-info/30", icon: Clock },
  in_progress: { label: "In Progress", color: "text-accent bg-accent/10 border-accent/30", icon: Play },
  completed: { label: "Completed", color: "text-success bg-success/10 border-success/30", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-danger bg-danger/10 border-danger/30", icon: XCircle },
  disputed: { label: "Disputed", color: "text-warning bg-warning/10 border-warning/30", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "text-muted bg-muted/10 border-muted/30", icon: XCircle },
};

export const StatusBadge = memo(function StatusBadge({
  status,
  size = "md",
}: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig[0];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border rounded-full font-mono",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        config.color
      )}
    >
      <Icon size={size === "sm" ? 12 : 14} />
      {config.label}
    </span>
  );
});
