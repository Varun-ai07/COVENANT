"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export const Skeleton = memo(function Skeleton({
  className,
  variant = "rectangular",
  width,
  height,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-surface-alt",
        variant === "circular" && "rounded-full",
        variant === "text" && "rounded-lg",
        variant === "rectangular" && "rounded-lg",
        className
      )}
      style={{
        width: width,
        height: height || (variant === "text" ? "1rem" : undefined),
      }}
    />
  );
});

// Preset skeletons
export const SkeletonText = memo(function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  const widths = ["75%", "82%", "68%", "90%", "73%", "85%", "78%"];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={widths[i % widths.length]}
          height="1rem"
        />
      ))}
    </div>
  );
});

export const SkeletonCard = memo(function SkeletonCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-xl p-5 space-y-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height="1rem" />
          <Skeleton variant="text" width="40%" height="0.75rem" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
});

export const SkeletonTable = memo(function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex gap-4 p-3 bg-surface-alt rounded-lg">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" className="flex-1" height="0.75rem" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-3 bg-surface rounded-lg">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton
              key={colIndex}
              variant="text"
              className="flex-1"
              height="0.875rem"
            />
          ))}
        </div>
      ))}
    </div>
  );
});
