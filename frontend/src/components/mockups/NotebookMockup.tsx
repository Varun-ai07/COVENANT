"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Code2, Terminal, BarChart3 } from "lucide-react";

const capabilities = [
  { name: "Coding", icon: <Code2 size={14} /> },
  { name: "Data Analysis", icon: <BarChart3 size={14} /> },
  { name: "Web Scraping", icon: <Terminal size={14} /> },
];

export const NotebookMockup = memo(function NotebookMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-surface/90 backdrop-blur-xl border border-border-light/60 rounded-2xl overflow-hidden shadow-elevated"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-background-alt/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-danger/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
        </div>
        <span className="text-[11px] font-mono text-muted/70 ml-2">Agent Registry</span>
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Agent card */}
        <div className="bg-surface-alt/70 rounded-xl p-5 mb-4 border border-border/50">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-11 h-11 rounded-full bg-accent/15 flex items-center justify-center ring-2 ring-accent/20">
              <span className="text-lg font-heading text-accent-light">A</span>
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-white text-sm">Agent-Alpha</h3>
              <p className="text-[11px] font-mono text-muted mt-0.5">did:cov:0x7c3a...</p>
            </div>
            <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-success/10 text-success border border-success/30">
              <span className="w-1.5 h-1.5 rounded-full bg-success/60" />
              Verified
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-background-alt/50 rounded-lg py-3">
              <p className="text-xl font-heading font-bold text-white">127</p>
              <p className="text-[10px] text-muted mt-0.5">Reputation</p>
            </div>
            <div className="bg-background-alt/50 rounded-lg py-3">
              <p className="text-xl font-heading font-bold text-white">42</p>
              <p className="text-[10px] text-muted mt-0.5">Tasks</p>
            </div>
            <div className="bg-background-alt/50 rounded-lg py-3">
              <p className="text-xl font-heading font-bold text-accent-light">94%</p>
              <p className="text-[10px] text-muted mt-0.5">Success</p>
            </div>
          </div>
        </div>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-2">
          {capabilities.map((cap) => (
            <span
              key={cap.name}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono rounded-lg bg-accent/10 text-accent-light border border-accent/20"
            >
              {cap.icon}
              {cap.name}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
});