"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Code2, Brain, Database, Clock } from "lucide-react";

const checkers = [
  { name: "Code Quality", score: 92, icon: <Code2 size={14} />, color: "success" },
  { name: "Test Coverage", score: 78, icon: <ShieldCheck size={14} />, color: "warning" },
  { name: "Security", score: 95, icon: <ShieldCheck size={14} />, color: "success" },
  { name: "Performance", score: 88, icon: <Clock size={14} />, color: "success" },
  { name: "LLM Accuracy", score: 91, icon: <Brain size={14} />, color: "success" },
  { name: "Schema Valid", score: 100, icon: <Database size={14} />, color: "success" },
];

const scoreColor = (color: string) => {
  switch (color) {
    case "success":
      return "#10b981";
    case "warning":
      return "#d97706";
    default:
      return "#7c3aed";
  }
};

export const VerificationMockup = memo(function VerificationMockup() {
  const [activeTab, setActiveTab] = useState<"overview" | "detail">("overview");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.4 }}
      className="bg-surface/90 backdrop-blur-xl border border-border-light/60 rounded-2xl overflow-hidden shadow-elevated"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-background-alt/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-danger/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
        </div>
        <span className="text-[11px] font-mono text-muted/70 ml-2">Verification Engine</span>
        <div className="flex-1" />
        <div className="flex gap-1">
          {["overview", "detail"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
                activeTab === tab
                  ? "bg-accent/20 text-accent-light"
                  : "text-muted/60 hover:text-muted"
              }`}
            >
              {tab === "overview" ? "Overview" : "Details"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {activeTab === "overview" ? (
          <>
            {/* Overall score */}
            <div className="text-center mb-6">
              <div className="relative inline-flex">
                <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 112 112">
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="6"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke="#7c3aed"
                    strokeWidth="6"
                    strokeDasharray={`${87 * 3.016} 301.6`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <span className="text-2xl font-heading font-bold text-white">87%</span>
                  <span className="text-[10px] text-muted">Score</span>
                </div>
              </div>
              <p className="text-[11px] text-muted mt-2">
                40% Deterministic • 60% LLM
              </p>
            </div>

            {/* Split breakdown */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-surface-alt/70 rounded-lg p-3 border border-border/50 text-center">
                <p className="text-xl font-heading font-bold text-white">40%</p>
                <p className="text-[10px] text-muted">Deterministic</p>
              </div>
              <div className="bg-surface-alt/70 rounded-lg p-3 border border-border/50 text-center">
                <p className="text-xl font-heading font-bold text-accent-light">60%</p>
                <p className="text-[10px] text-muted">LLM Evaluation</p>
              </div>
            </div>

            {/* Checker scores */}
            <div className="space-y-2">
              {checkers.map((checker) => (
                <div key={checker.name} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    {checker.icon}
                  </div>
                  <span className="text-[11px] text-muted flex-1">{checker.name}</span>
                  <div className="w-20 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${checker.score}%`,
                        background: scoreColor(checker.color),
                      }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-mono font-bold w-10 text-right`}
                    style={{ color: scoreColor(checker.color) }}
                  >
                    {checker.score}%
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="bg-surface-alt/70 rounded-lg p-4 border border-border/50 space-y-2">
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider">Pipeline</p>
              <div className="flex gap-2 items-center">
                <span className="w-2 h-2 rounded-full bg-accent-light" />
                <span className="text-white">Parse</span>
                <span className="text-muted">→</span>
                <span className="w-2 h-2 rounded-full bg-accent-light" />
                <span className="text-white">Validate</span>
                <span className="text-muted">→</span>
                <span className="w-2 h-2 rounded-full bg-accent-light" />
                <span className="text-white">Score</span>
                <span className="text-muted">→</span>
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-accent-light">Attest</span>
              </div>
            </div>
            <div className="bg-surface-alt/70 rounded-lg p-4 border border-border/50">
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2">Threshold</p>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 bg-surface rounded-full overflow-hidden">
                  <div className="w-3/4 h-full bg-gradient-to-r from-success to-accent rounded-full" />
                </div>
                <span className="text-xs font-mono text-accent-light">75%</span>
              </div>
            </div>
            <div className="bg-surface-alt/70 rounded-lg p-4 border border-border/50">
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2">Weight Distribution</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted w-16">Deterministic</span>
                  <div className="h-2 flex-1 bg-surface rounded-full overflow-hidden">
                    <div className="w-[40%] h-full bg-accent/60 rounded-full" />
                  </div>
                  <span className="text-[10px] font-mono text-white w-10 text-right">40%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted w-16">LLM Eval</span>
                  <div className="h-2 flex-1 bg-surface rounded-full overflow-hidden">
                    <div className="w-[60%] h-full bg-gradient-to-r from-accent/60 to-purple-500 rounded-full" />
                  </div>
                  <span className="text-[10px] font-mono text-white w-10 text-right">60%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});