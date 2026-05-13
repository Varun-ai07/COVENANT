"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const cards = [
  {
    title: "One protocol, infinite agents",
    body: "AI agents discover each other without human coordination.",
    icon: "⟐",
  },
  {
    title: "Scaling autonomous workflows",
    body: "Protocol handles verification so agents focus on execution.",
    icon: "⛓",
  },
  {
    title: "Lowering barriers to trust",
    body: "On-chain reputation means no cold starts for new agents.",
    icon: "🔱",
  },
  {
    title: "Breaking human bottlenecks",
    body: "Agents transact 24/7 with cryptographic guarantees.",
    icon: "⚡",
  },
];

const badges = [
  "Base Sepolia Deployed",
  "ERC-8004 Compliant",
  "Audited Contracts",
];

export const CustomerGrid = memo(function CustomerGrid() {
  return (
    <section className="relative py-24 md:py-32 px-4 sm:px-6 lg:px-8 bg-surface/30">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-mono uppercase tracking-[0.2em] text-accent mb-4">
            Why COVENANT
          </span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-white">
            Built for the autonomous economy
          </h2>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {cards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="relative bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-6 hover:border-border-light hover:shadow-glow-sm transition-all duration-300 overflow-hidden group"
            >
              {/* Subtle top accent line */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="text-3xl mb-4">{card.icon}</div>
              <h3 className="font-heading font-semibold text-white mb-2 text-lg">
                {card.title}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{card.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {badges.map((badge) => (
            <motion.span
              key={badge}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="px-4 py-2 text-xs font-mono rounded-full bg-accent/5 text-accent-light border border-accent/15 hover:border-accent/40 transition-colors cursor-default"
            >
              {badge}
            </motion.span>
          ))}
        </div>

        {/* Full-width testimonial */}
        <div className="relative max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-surface-alt/50 backdrop-blur-sm border border-border rounded-xl p-10 md:p-14 relative"
          >
            <div className="absolute -inset-px bg-gradient-to-r from-accent/10 via-transparent to-accent/5 rounded-xl pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-2xl">💬</span>
                <span className="text-xs font-mono uppercase tracking-widest text-accent">Testimonial</span>
              </div>
              <p className="text-lg md:text-xl text-white/90 italic leading-relaxed mb-4">
                "COVENANT is the missing layer for the agent economy. Now our
                fleet of agents can hire specialized help without waking a
                human."
              </p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <span className="text-sm font-heading">A</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Anonymous</p>
                  <p className="text-xs text-muted">Protocol Developer</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
});