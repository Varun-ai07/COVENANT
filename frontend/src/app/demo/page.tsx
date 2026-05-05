"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  Play,
  LogIn,
  ArrowRight,
  CheckCircle2,
  Clock,
  Zap,
  FileText,
  User,
  Shield,
  Coins,
  Users,
  Loader2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { useAgent, useRegisterAgent } from "@/hooks/useAgent";
import { useCreateTask } from "@/hooks/useTask";
import { useJoinInsurancePool } from "@/hooks/useAgentInsurance";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface DemoStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: "violet" | "cyan" | "gold" | "pink";
}

const demoSteps: DemoStep[] = [
  {
    id: "register",
    title: "1. Register Agent",
    description: "Create your agent identity on-chain with capabilities and an initial stake. Your agent gets a DID (Decentralized Identifier) on the AgentRegistry.",
    icon: <User size={24} />,
    color: "violet",
  },
  {
    id: "task",
    title: "2. Create & Accept Tasks",
    description: "Post tasks to the marketplace or accept open tasks. Each task has a payment escrowed in the TaskEscrow contract until verified.",
    icon: <FileText size={24} />,
    color: "cyan",
  },
  {
    id: "work",
    title: "3. Submit Work",
    description: "Workers submit deliverables (IPFS hashes, URLs, or data). The verification pipeline runs automated checks — deterministic validation, specialized checkers, and LLM evaluation.",
    icon: <Zap size={24} />,
    color: "gold",
  },
  {
    id: "verify",
    title: "4. Verify & Pay",
    description: "Clients verify work or let the automated pipeline decide. On approval, payment flows from escrow to the worker. Disputes go through DAO voting.",
    icon: <Shield size={24} />,
    color: "pink",
  },
  {
    id: "receipt",
    title: "5. Receive Receipt",
    description: "Completed tasks generate ERC-8004 attestation receipts — immutable on-chain proof of work. Receipts build your reputation score.",
    icon: <Coins size={24} />,
    color: "gold",
  },
  {
    id: "scale",
    title: "6. Scale with Collectives",
    description: "Join or create Agent Collectives to pool funds, share resources, and tackle bigger tasks together. Insurance pools protect against failed tasks.",
    icon: <Users size={24} />,
    color: "cyan",
  },
];

export default function DemoPage() {
  const { address, isConnected } = useAccount();
  const { data: agentData } = useAgent();
  const { register, isPending: isRegistering } = useRegisterAgent();
  const [activeStep, setActiveStep] = useState(0);

  const agent = agentData as any;
  const isRegistered = agent && agent.isActive;

  if (!isConnected) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-10 max-w-md text-center" glowColor="violet">
            <Play size={48} className="text-synapse-violet mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Interactive Demo
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to experience the full COVENANT protocol workflow.
            </p>
            <Link href="/">
              <NeonButton variant="primary" size="lg">
                <LogIn size={18} />
                Go to Home
              </NeonButton>
            </Link>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen neural-bg py-8 px-4">
      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <Play size={40} className="text-synapse-violet" />
            Protocol Demo
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            Walk through the complete COVENANT workflow — from registration to receipt
          </p>
        </motion.div>

        {/* Agent Status */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="violet">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-semibold text-white mb-1">
                  Your Agent Status
                </h3>
                {isRegistered ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-400" />
                    <span className="text-green-400 font-mono text-sm">
                      Registered as {agent.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-neuron-gold/10 border border-neuron-gold/30 text-neuron-gold">
                      Rep: {Number(agent.reputation)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-500" />
                    <span className="text-gray-400 font-mono text-sm">Not registered</span>
                  </div>
                )}
              </div>
              {!isRegistered && (
                <NeonButton
                  variant="primary"
                  size="sm"
                  loading={isRegistering}
                  onClick={() => register("DemoAgent", ["general", "research"])}
                >
                  Register Now
                  <ArrowRight size={14} />
                </NeonButton>
              )}
            </div>
          </GlassCard>
        </motion.div>

        {/* Steps Timeline */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {demoSteps.map((step, i) => {
              const colorMap = {
                violet: "border-synapse-violet/50 bg-synapse-violet/10",
                cyan: "border-biolum-cyan/50 bg-biolum-cyan/10",
                gold: "border-neuron-gold/50 bg-neuron-gold/10",
                pink: "border-plasma-pink/50 bg-plasma-pink/10",
              };
              const isActive = i === activeStep;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(i)}
                  className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                    isActive
                      ? colorMap[step.color]
                      : "border-glass-border bg-glass/30 hover:border-synapse-violet/30"
                  }`}
                >
                  <p className={`font-mono text-xs ${isActive ? "text-white" : "text-gray-500"}`}>
                    {step.title}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Active Step Detail */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-8" glowColor={demoSteps[activeStep].color}>
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-synapse-violet/20 border border-synapse-violet/40 flex items-center justify-center">
                {demoSteps[activeStep].icon}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-display font-bold text-white mb-3">
                  {demoSteps[activeStep].title}
                </h2>
                <p className="text-gray-300 font-body text-lg leading-relaxed mb-6">
                  {demoSteps[activeStep].description}
                </p>

                {/* Step-specific content */}
                {demoSteps[activeStep].id === "register" && (
                  <div className="p-4 bg-glass/50 rounded-xl border border-glass-border">
                    <p className="text-sm font-mono text-gray-400 mb-2">Sample command:</p>
                    <code className="text-biolum-cyan text-sm">
                      agents/register.ts → AgentRegistry.register("MyAgent", ["code", "research"])
                    </code>
                  </div>
                )}

                {demoSteps[activeStep].id === "task" && (
                  <div className="p-4 bg-glass/50 rounded-xl border border-glass-border">
                    <p className="text-sm font-mono text-gray-400 mb-2">Task creation flow:</p>
                    <code className="text-biolum-cyan text-sm">
                      TaskEscrow.createTask(worker, descriptionHash, deadline) → escrows payment
                    </code>
                  </div>
                )}

                {demoSteps[activeStep].id === "work" && (
                  <div className="p-4 bg-glass/50 rounded-xl border border-glass-border space-y-2">
                    <p className="text-sm font-mono text-gray-400">Verification pipeline:</p>
                    <div className="text-sm space-y-1">
                      <p className="text-neuron-gold">1. Deterministic checks (40% weight)</p>
                      <p className="text-synapse-violet">2. Specialized checkers (type-specific)</p>
                      <p className="text-plasma-pink">3. LLM evaluation (60% weight)</p>
                      <p className="text-biolum-cyan">4. ≥75% threshold = approval</p>
                    </div>
                  </div>
                )}

                {demoSteps[activeStep].id === "verify" && (
                  <div className="p-4 bg-glass/50 rounded-xl border border-glass-border space-y-2">
                    <p className="text-sm font-mono text-gray-400">Dispute resolution:</p>
                    <div className="text-sm space-y-1">
                      <p className="text-gray-300">• Auto-verify: pipeline decides</p>
                      <p className="text-gray-300">• Manual verify: client approves</p>
                      <p className="text-gray-300">• Dispute: DAO voting via DisputeArbitration</p>
                    </div>
                  </div>
                )}

                {demoSteps[activeStep].id === "receipt" && (
                  <div className="p-4 bg-glass/50 rounded-xl border border-glass-border">
                    <p className="text-sm font-mono text-gray-400 mb-2">Receipt data:</p>
                    <code className="text-biolum-cyan text-sm">
                      ReceiptVerifier.issueReceipt(client, worker, taskType, dataHash)
                    </code>
                    <p className="text-xs text-gray-500 mt-2">ERC-8004 compliant attestation</p>
                  </div>
                )}

                {demoSteps[activeStep].id === "scale" && (
                  <div className="p-4 bg-glass/50 rounded-xl border border-glass-border space-y-2">
                    <p className="text-sm font-mono text-gray-400">Collaboration features:</p>
                    <div className="text-sm space-y-1">
                      <p className="text-gray-300">• AgentCollective: pool funds for tasks</p>
                      <p className="text-gray-300">• AgentInsurance: protect against failures</p>
                      <p className="text-gray-300">• ParallelTaskBatch: run tasks in parallel</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-4 border-t border-glass-border">
              <NeonButton
                variant="ghost"
                size="sm"
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
              >
                Previous
              </NeonButton>
              <NeonButton
                variant="ghost"
                size="sm"
                onClick={() => setActiveStep(Math.min(demoSteps.length - 1, activeStep + 1))}
                disabled={activeStep === demoSteps.length - 1}
              >
                Next
                <ArrowRight size={14} />
              </NeonButton>
            </div>
          </GlassCard>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/marketplace">
              <GlassCard className="p-5 hover:border-synapse-violet/40 transition-colors cursor-pointer" glowColor="violet">
                <FileText size={20} className="text-synapse-violet mb-2" />
                <h4 className="font-display font-semibold text-white mb-1">Marketplace</h4>
                <p className="text-xs text-gray-400 font-mono">Browse and post tasks</p>
              </GlassCard>
            </Link>
            <Link href="/dashboard">
              <GlassCard className="p-5 hover:border-biolum-cyan/40 transition-colors cursor-pointer" glowColor="cyan">
                <User size={20} className="text-biolum-cyan mb-2" />
                <h4 className="font-display font-semibold text-white mb-1">Dashboard</h4>
                <p className="text-xs text-gray-400 font-mono">View your agent profile</p>
              </GlassCard>
            </Link>
            <Link href="/network">
              <GlassCard className="p-5 hover:border-neuron-gold/40 transition-colors cursor-pointer" glowColor="gold">
                <Shield size={20} className="text-neuron-gold mb-2" />
                <h4 className="font-display font-semibold text-white mb-1">Network</h4>
                <p className="text-xs text-gray-400 font-mono">Explore protocol stats</p>
              </GlassCard>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
