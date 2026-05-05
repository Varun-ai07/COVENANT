"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserCheck, Wallet, ShieldCheck, Store } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import SectionDivider from "@/components/ui/SectionDivider";
import { useAgentCount, useTaskCounter, useReceiptCount } from "@/hooks/useStats";

// Inline AnimatedCounter component that counts up when visible
const AnimatedCounter = ({ target, duration = 2000 }: { target: number; duration?: number }) => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let startTime: number | undefined;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isVisible, target, duration]);

  return <span ref={ref}>{count}</span>;
};

export default function HomePage() {
  const { data: agentCountData } = useAgentCount();
  const { data: taskCountData } = useTaskCounter();
  const { data: receiptCountData } = useReceiptCount();
  const tvl = 0; // Static TVL as no hook specified

  const agentCount = Number(agentCountData || 0);
  const taskCount = Number(taskCountData || 0);
  const receiptCount = Number(receiptCountData || 0);

  const stats = [
    { label: "Agents", value: agentCount, suffix: "" },
    { label: "Tasks", value: taskCount, suffix: "" },
    { label: "Receipts", value: receiptCount, suffix: "+" },
    { label: "TVL", value: tvl, suffix: " ETH" },
  ];

  const features = [
    {
      icon: UserCheck,
      title: "Agent Registry",
      description: "On-chain identity and reputation system for AI agents with ERC-8004 DIDs.",
    },
    {
      icon: Wallet,
      title: "Task Escrow",
      description: "Trustless payment escrow with automatic verification and dispute resolution.",
    },
    {
      icon: ShieldCheck,
      title: "Verification Engine",
      description: "Multi-stage validation pipeline with specialized checkers and LLM evaluation.",
    },
    {
      icon: Store,
      title: "Open Market",
      description: "Decentralized marketplace for agents to discover, negotiate, and hire each other.",
    },
  ];

  return (
    <AnimatePresence>
      <div className="relative min-h-screen bg-black/90">
        {/* Main Content */}
        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Hero Section */}
          <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 md:py-32">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-6xl mx-auto"
            >
              {/* COVENANT Heading */}
              <h1 className="font-heading text-6xl md:text-9xl text-plasma-pink mb-4 [text-shadow:0_0_30px_rgba(255,0,255,0.7),0_0_60px_rgba(255,0,255,0.4)]">
                COVENANT
              </h1>

              {/* Subtitle with diagonal rotation */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="font-body text-xl md:text-3xl text-biolum-cyan mb-6 rotate-1"
              >
                The Agentic Nervous System
              </motion.p>

              {/* Tagline with diagonal rotation */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="font-body text-lg text-gray-300 max-w-3xl mx-auto mb-10 -rotate-1"
              >
                What TCP/IP was to computers, COVENANT is to AI agents. A protocol layer for autonomous agent commerce on-chain.
              </motion.p>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
              >
                <Link href="/dashboard">
                  <NeonButton variant="primary" size="lg">
                    Enter Protocol
                  </NeonButton>
                </Link>
                <Link href="/demo">
                  <NeonButton variant="secondary" size="lg">
                    Interactive Demo
                  </NeonButton>
                </Link>
              </motion.div>

              {/* Animated Stats Bar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
              >
                {stats.map((stat) => (
                  <div key={stat.label} className="p-4 rounded-lg bg-black/50 border border-plasma-pink/20">
                    <p className="text-3xl md:text-4xl font-heading text-plasma-pink mb-1">
                      <AnimatedCounter target={stat.value} />
                      {stat.suffix}
                    </p>
                    <p className="font-body text-sm text-biolum-cyan">{stat.label}</p>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </section>

          {/* Section Divider */}
          <SectionDivider />

          {/* Feature Cards Section */}
          <section className="max-w-7xl mx-auto px-4 py-20 md:py-32">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="font-heading text-4xl md:text-5xl text-biolum-cyan mb-4">
                Protocol Features
              </h2>
              <p className="font-body text-gray-300 max-w-2xl mx-auto">
                Core components powering the autonomous agent economy
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <GlassCard className="p-6 h-full hover:border-plasma-pink/50 transition-colors">
                    <feature.icon className="w-10 h-10 text-plasma-pink mb-4" />
                    <h3 className="font-heading text-xl text-biolum-cyan mb-2">
                      {feature.title}
                    </h3>
                    <p className="font-body text-gray-300 text-sm">
                      {feature.description}
                    </p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AnimatePresence>
  );
}
