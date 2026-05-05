"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface LoadingPulseProps {
  className?: string;
  lines?: number;
}

const widths = [75, 82, 68, 90, 73];

export const LoadingPulse = memo(function LoadingPulse({
  className = "",
  lines = 3,
}: LoadingPulseProps) {
  return (
    <div className={cn("space-y-3 animate-pulse", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded-lg bg-glass"
          style={{ width: `${widths[i % widths.length]}%` }}
        />
      ))}
    </div>
  );
});
