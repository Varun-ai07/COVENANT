"use client";

import { cn } from "@/lib/utils";

interface SectionDividerProps {
  title?: string;
  className?: string;
  diagonal?: boolean;
}

export default function SectionDivider({
  title,
  className = "",
  diagonal = true,
}: SectionDividerProps) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-4 my-8",
        diagonal && "transform -rotate-1",
        className
      )}
    >
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-glass-border to-transparent" />
      {title && (
        <span className="font-heading text-sm text-synapse-violet/70 uppercase tracking-widest whitespace-nowrap">
          {title}
        </span>
      )}
      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-glass-border to-transparent" />
    </div>
  );
}
