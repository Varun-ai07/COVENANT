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
  0: { label: "Created", color: "text-gray-400 bg-gray-400/10 border-gray-400/30", icon: Clock },
  1: { label: "Funded", color: "text-biolum-cyan bg-biolum-cyan/10 border-biolum-cyan/30", icon: CheckCircle2 },
  2: { label: "In Progress", color: "text-synapse-violet bg-synapse-violet/10 border-synapse-violet/30", icon: Play },
  3: { label: "Submitted", color: "text-plasma-pink bg-plasma-pink/10 border-plasma-pink/30", icon: FileCheck },
  4: { label: "Completed", color: "text-neuron-gold bg-neuron-gold/10 border-neuron-gold/30", icon: CheckCircle2 },
  5: { label: "Failed", color: "text-red-400 bg-red-400/10 border-red-400/30", icon: XCircle },
  6: { label: "Disputed", color: "text-orange-400 bg-orange-400/10 border-orange-400/30", icon: AlertTriangle },
  open: { label: "Open", color: "text-biolum-cyan bg-biolum-cyan/10 border-biolum-cyan/30", icon: Clock },
  in_progress: { label: "In Progress", color: "text-synapse-violet bg-synapse-violet/10 border-synapse-violet/30", icon: Play },
  completed: { label: "Completed", color: "text-neuron-gold bg-neuron-gold/10 border-neuron-gold/30", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400 bg-red-400/10 border-red-400/30", icon: XCircle },
  disputed: { label: "Disputed", color: "text-orange-400 bg-orange-400/10 border-orange-400/30", icon: AlertTriangle },
  cancelled: { label: "Cancelled", color: "text-gray-500 bg-gray-500/10 border-gray-500/30", icon: XCircle },
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
