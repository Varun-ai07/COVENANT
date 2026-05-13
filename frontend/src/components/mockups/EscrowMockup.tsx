"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Lock, Clock, CheckCircle2 } from "lucide-react";

const escrowSteps = [
  { label: "Created", status: "complete", icon: <Lock size={12} /> },
  { label: "Funded", status: "complete", icon: <Lock size={12} /> },
  { label: "In Progress", status: "active", icon: <Clock size={12} /> },
  { label: "Verified", status: "pending", icon: <CheckCircle2 size={12} /> },
  { label: "Released", status: "pending", icon: <CheckCircle2 size={12} /> },
];

export const EscrowMockup = memo(function EscrowMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="bg-surface/90 backdrop-blur-xl border border-border-light/60 rounded-2xl overflow-hidden shadow-elevated"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-background-alt/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-danger/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
        </div>
        <span className="text-[11px] font-mono text-muted/70 ml-2">Task Escrow</span>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Task info */}
        <div className="bg-surface-alt/70 rounded-xl p-4 mb-6 border border-border/50">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-heading font-bold text-white text-sm">Task #42</h3>
              <p className="text-[11px] font-mono text-muted mt-0.5">Data parsing pipeline</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-heading font-bold text-accent-light">0.5 ETH</p>
              <p className="text-[10px] text-muted flex items-center gap-1 justify-end mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/60" />
                Locked
              </p>
            </div>
          </div>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-between mb-6">
          {escrowSteps.map((step, i) => (
            <div key={i} className="flex flex-col items-center relative">
              {/* Connector line */}
              {i < escrowSteps.length - 1 && (
                <div className="absolute top-4 left-[calc(50%+12px)] right-[calc(-50%+12px)] h-px bg-border/40" />
              )}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-mono transition-all duration-300
                  ${step.status === "complete" ? "bg-success/20 text-success border border-success/40" : ""}
                  ${step.status === "active" ? "bg-accent/20 text-accent-light border border-accent/50 animate-pulse shadow-glow-sm" : ""}
                  ${step.status === "pending" ? "bg-surface-alt text-muted border border-border/50" : ""}
                `}
              >
                {step.icon}
              </div>
              <p className="text-[10px] text-muted mt-2">{step.label}</p>
            </div>
          ))}
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-alt/70 rounded-lg p-3 border border-border/50">
            <p className="text-[10px] text-muted mb-1 uppercase tracking-wider">Client</p>
            <p className="text-[11px] font-mono text-white/90 truncate">0x1a2b...3c4d</p>
          </div>
          <div className="bg-surface-alt/70 rounded-lg p-3 border border-border/50">
            <p className="text-[10px] text-muted mb-1 uppercase tracking-wider">Worker</p>
            <p className="text-[11px] font-mono text-white/90 truncate">0x5e6f...7g8h</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
});