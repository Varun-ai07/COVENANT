"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Zap, Server, Cloud, Terminal } from "lucide-react";

const techStack: { name: string; size: "lg" | "md" | "sm"; highlight?: boolean; icon?: React.ReactNode }[] = [
  { name: "Base", size: "lg", icon: <Server size={16} /> },
  { name: "Ethereum", size: "lg", icon: <Cloud size={16} /> },
  { name: "IPFS", size: "lg", icon: <Zap size={16} /> },
  { name: "Pinata", size: "lg" },
  { name: "Viem", size: "md" },
  { name: "Hardhat", size: "md" },
  { name: "OpenZeppelin", size: "md" },
  { name: "Ethers", size: "md" },
  { name: "Wagmi", size: "md" },
  { name: "RainbowKit", size: "md" },
  { name: "MCP", size: "sm", highlight: true },
  { name: "SDK", size: "sm", highlight: true },
  { name: "The Graph", size: "sm" },
  { name: "Framer", size: "sm" },
  { name: "Tailwind", size: "sm" },
  { name: "Next.js", size: "sm" },
  { name: "Supabase", size: "sm" },
];

const features = [
  {
    title: "Built for L2",
    body: "Gas-efficient contracts on Base. Sub-second finality.",
    icon: <Server size={18} />,
  },
  {
    title: "IPFS-native",
    body: "Encrypted task specs stored off-chain with Pinata.",
    icon: <Cloud size={18} />,
  },
  {
    title: "Wallet connect",
    body: "RainbowKit for seamless wallet authentication.",
    icon: <Zap size={18} />,
  },
  {
    title: "Real-time events",
    body: "Wagmi hooks for live on-chain data streaming.",
    icon: <Terminal size={18} />,
  },
  {
    title: "Modular architecture",
    body: "Compose contracts for custom agent workflows.",
    icon: <Zap size={18} />,
  },
  {
    title: "Open source",
    body: "Audited contracts, MIT license, community-governed.",
    icon: <Server size={18} />,
  },
  {
    title: "MCP Tools",
    body: "Model Context Protocol integration for AI agent tooling.",
    icon: <Cloud size={18} />,
  },
  {
    title: "TypeScript SDK",
    body: "Full-featured SDK for programmatic protocol interaction.",
    icon: <Terminal size={18} />,
  },
];

const sizeClasses = {
  lg: "h-14 text-base",
  md: "h-11 text-sm",
  sm: "h-9 text-xs",
};

export const Integrations = memo(function Integrations() {
  return (
    <section className="relative py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/3 blur-[120px] opacity-20 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-mono uppercase tracking-[0.2em] text-accent mb-4">
            Integrations
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
            Enterprise-grade infrastructure
          </h2>
          <p className="text-muted max-w-xl mx-auto text-lg">
            Battle-tested tools and frameworks powering the protocol
          </p>
        </motion.div>

        {/* Tech stack grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-20">
          {techStack.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              whileHover={{ scale: 1.05 }}
              className={`group relative flex flex-col items-center justify-center gap-1 ${sizeClasses[tech.size]} px-4 rounded-lg border border-border/50 hover:border-accent/40 hover:bg-accent/5 transition-all duration-300 ${
                tech.highlight ? "text-accent border-accent/40" : "text-muted"
              }`}
            >
              {tech.highlight && (
                <div className="absolute -top-1 -right-1 px-2 py-[1px] text-[9px] font-mono bg-accent text-background rounded-sm">
                  NEW
                </div>
              )}
              <span className="text-muted group-hover:text-white transition-colors">
                {tech.icon}
              </span>
              <span className="font-medium tracking-tight">{tech.name}</span>
            </motion.div>
          ))}
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group relative bg-surface/70 backdrop-blur-sm border border-border rounded-xl p-6 hover:border-border-light hover:shadow-elevated transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors shrink-0">
                  {feat.icon}
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-white mb-2 group-hover:text-accent-light transition-colors">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-muted leading-relaxed">{feat.body}</p>
                </div>
              </div>

              {/* Hover underline */}
              <div className="absolute bottom-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});