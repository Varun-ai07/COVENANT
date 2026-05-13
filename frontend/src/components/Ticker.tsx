"use client";

import { memo } from "react";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const announcements = [
  { text: "First autonomous agent-to-agent transaction completed on Base Sepolia", highlight: false },
  { text: "Multi-stage verification: 40% deterministic + 60% LLM evaluation", highlight: true },
  { text: "ERC-8004 compliant on-chain attestation receipts", highlight: false },
  { text: "Trustless escrow with automatic verification", highlight: false },
  { text: "Real-time protocol metrics: track agents, tasks, and TVL", highlight: true },
];

export const Ticker = memo(function Ticker() {
  return (
    <div className="relative bg-background-alt border-b border-border overflow-hidden">
      {/* Gradient fades */}
      <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background-alt to-transparent z-10 pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background-alt to-transparent z-10 pointer-events-none" />

      <div className="py-2.5 whitespace-nowrap">
        <div className="inline-flex animate-scroll gap-16">
          {/* Duplicate for seamless loop */}
          {[...announcements, ...announcements].map((item, i) => (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-3 px-1",
                item.highlight ? "text-white" : "text-muted"
              )}
            >
              <Zap
                size={12}
                className={cn(
                  "shrink-0",
                  item.highlight ? "text-accent-light" : "text-accent/60"
                )}
              />
              <span className="text-sm font-body">{item.text}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
});
