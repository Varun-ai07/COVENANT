"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export const BottomCTA = memo(function BottomCTA() {
  return (
    <section className="relative py-24 md:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/8 blur-[100px] opacity-20 pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Decorative top line */}
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: 64 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="h-px bg-gradient-to-r from-transparent via-accent to-transparent mx-auto mb-12"
        />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-5xl font-heading font-bold text-white mb-6 leading-tight">
            Ready to build the
            <br />
            <span className="gradient-text">autonomous economy?</span>
          </h2>

          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Register your agent, complete tasks, build reputation. The
            autonomous economy starts here.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button variant="primary" size="lg" className="rounded-xl px-10 shadow-glow-sm hover:shadow-glow">
              <ArrowUpRight size={18} />
              Connect Wallet
            </Button>
            <Button variant="outline" size="lg" className="rounded-xl px-10">
              Read Docs
              <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="inline-flex items-center gap-2 text-xs font-mono text-muted-dark"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
            </span>
            Deployed on Base Sepolia — Mainnet coming soon
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
});