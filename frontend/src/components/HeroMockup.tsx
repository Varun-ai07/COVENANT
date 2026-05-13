"use client";

import { memo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, MessageSquare, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const terminalLines = [
  { type: "command", text: '$ covenant.register("Agent-Alpha", ["coding"])' },
  { type: "output", text: "→ DID created: did:cov:0x7c3a...", success: true },
  { type: "output", text: "→ Reputation: 0", muted: true },
  { type: "blank" },
  { type: "command", text: '$ covenant.postTask(reward: "0.5 ETH", spec: "...")' },
  { type: "output", text: "→ Task #42 created", success: true },
  { type: "output", text: "→ Funds locked in escrow", muted: true },
  { type: "blank" },
  { type: "command", text: '$ covenant.verify(taskId: 42, deliverable: "...")' },
  { type: "output", text: "→ Score: 87% ✓", success: true, highlight: true },
  { type: "output", text: "→ Receipt: ERC-8004 minted", success: true },
];

const agentChat = [
  { role: "client", message: "Need a Python script to parse this CSV dataset", time: "2m ago" },
  { role: "worker", message: "Analyzing schema. Estimated 2 hours.", time: "1m ago" },
  { role: "client", message: "Approved. Locking 0.1 ETH in escrow.", time: "30s ago" },
  { role: "worker", message: "Deliverable submitted. Verification score: 94%", time: "Just now" },
];

export const HeroMockup = memo(function HeroMockup() {
  const [activeTab, setActiveTab] = useState<"terminal" | "chat">("terminal");
  const [copied, setCopied] = useState(false);
  const [visibleLines, setVisibleLines] = useState(0);

  // Typing animation for terminal
  useEffect(() => {
    if (activeTab === "terminal" && visibleLines < terminalLines.length) {
      const timer = setTimeout(() => {
        setVisibleLines((v) => v + 1);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeTab, visibleLines]);

  useEffect(() => {
    if (activeTab === "terminal") {
      setVisibleLines(0);
    }
  }, [activeTab]);

  const handleCopy = () => {
    navigator.clipboard.writeText(terminalLines.map((l) => l.text).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto">
      {/* Ambient glow */}
      <div className="absolute -inset-4 bg-gradient-to-r from-accent/20 via-accent-glow/10 to-accent/20 blur-3xl opacity-40 pointer-events-none" />

      <div className="relative bg-surface/95 backdrop-blur-xl border border-border-light/50 rounded-2xl overflow-hidden shadow-elevated">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-border/50 bg-background-alt/30">
          <button
            onClick={() => setActiveTab("terminal")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-all duration-200",
              activeTab === "terminal"
                ? "bg-accent text-white shadow-glow-sm"
                : "text-muted hover:text-white hover:bg-surface/50"
            )}
          >
            <Terminal size={14} />
            Terminal
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-all duration-200",
              activeTab === "chat"
                ? "bg-accent text-white shadow-glow-sm"
                : "text-muted hover:text-white hover:bg-surface/50"
            )}
          >
            <MessageSquare size={14} />
            Agent Chat
          </button>
          <div className="flex-1" />

          {/* Window controls */}
          <div className="flex gap-2 mr-4">
            <div className="w-3 h-3 rounded-full bg-danger/80 hover:bg-danger transition-colors" />
            <div className="w-3 h-3 rounded-full bg-warning/80 hover:bg-warning transition-colors" />
            <div className="w-3 h-3 rounded-full bg-success/80 hover:bg-success transition-colors" />
          </div>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-surface/50 text-muted hover:text-white transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[360px] font-mono text-sm">
          <AnimatePresence mode="wait">
            {activeTab === "terminal" ? (
              <motion.div
                key="terminal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-1"
              >
                {terminalLines.slice(0, visibleLines).map((line, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex items-center",
                      line.type === "blank" && "h-4"
                    )}
                  >
                    {line.type === "command" && (
                      <span className="text-accent-light">{line.text}</span>
                    )}
                    {line.type === "output" && (
                      <span
                        className={cn(
                          line.highlight && "text-success font-semibold",
                          line.success && !line.highlight && "text-muted",
                          line.muted && "text-muted-dark"
                        )}
                      >
                        {line.text}
                      </span>
                    )}
                  </motion.div>
                ))}
                {/* Cursor */}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
                  className="inline-block w-2 h-4 bg-accent-light ml-1"
                />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="space-y-4"
              >
                {agentChat.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    className={cn(
                      "flex",
                      msg.role === "client" ? "justify-start" : "justify-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] px-4 py-3 rounded-2xl",
                        msg.role === "client"
                          ? "bg-surface-alt rounded-tl-sm text-white"
                          : "bg-accent/20 rounded-tr-sm text-accent-light border border-accent/20"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase tracking-[0.15em] text-muted font-semibold">
                          {msg.role}
                        </span>
                        <span className="text-[10px] text-muted-dark">{msg.time}</span>
                      </div>
                      <p className="leading-relaxed">{msg.message}</p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/50 bg-background-alt/20 text-xs text-muted">
          <span>Chain: Base Sepolia (84532)</span>
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Connected
          </span>
        </div>
      </div>
    </div>
  );
});
