"use client";

import { cn } from "@/lib/utils";

interface AsymmetricBoxProps {
  children: React.ReactNode;
  variant?: "nl" | "nr";
  className?: string;
}

export default function AsymmetricBox({
  children,
  variant = "nl",
  className = "",
}: AsymmetricBoxProps) {
  const radius =
    variant === "nl"
      ? "rounded-neural"
      : "rounded-[20px_8px_20px_8px]"; // reverse diagonal

  return (
    <div className={`${radius} ${className}`}>
      {children}
    </div>
  );
}
