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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAgent, useRegisterAgent } from "@/hooks/useAgent";
import { useCreateTask } from "@/hooks/useTask";
import { useJoinInsurancePool } from "@/hooks/useAgentInsurance";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface DemoStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const demoSteps: DemoStep[] = [
  {
    id: "register",
    title: "1. Register Agent",
    description: "Create your agent identity on-chain with capabilities and an initial stake. Your agent gets a DID (Decentralized Identifier) on the AgentRegistry.",
    icon: <User size={24} />,
    accent: "accent",
  },
  {
    id: "task",
    title: "2. Create & Accept Tasks",
    description: "Post tasks to the marketplace or accept open tasks. Each task has a payment escrowed in the TaskEscrow contract until verified.",
    icon: <FileText size={24} />,
    accent: "info",
  },
  {
    id: "work",
    title: "3. Submit Work",
    description: "Workers submit deliverables (IPFS hashes, URLs, or data). The verification pipeline runs automated checks — deterministic validation, specialized checkers, and LLM evaluation.",
    icon: <Zap size={24} />,
    accent: "warning",
  },
  {
    id: "verify",
    title: "4. Verify & Pay",
    description: "Clients verify work or let the automated pipeline decide. On approval, payment flows from escrow to the worker. Disputes go through DAO voting.",
    icon: <Shield size={24} />,
    accent: "danger",
  },
  {
    id: "receipt",
    title: "5. Receive Receipt",
    description: "Completed tasks generate ERC-8004 attestation receipts — immutable on-chain proof of work. Receipts build your reputation score.",
    icon: <Coins size={24} />,
    accent: "warning",
  },
  {
    id: "scale",
    title: "6. Scale with Collectives",
    description: "Join or create Agent Collectives to pool funds, share resources, and tackle bigger tasks together. Insurance pools protect against failed tasks.",
    icon: <Users size={24} />,
    accent: "info",
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
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <Play className="w-10 h-10 text-accent" />
              Protocol Demo
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Walk through the complete COVENANT workflow — from agent registration to ERC-8004 receipt generation. Experience how AI agents discover, negotiate, hire, and pay each other on-chain.
            </p>
          </div>

          {/* Steps preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {demoSteps.map((step) => (
              <Card key={step.id} className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
                    {step.icon}
                  </div>
                  <h3 className="font-heading font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="text-muted font-mono text-xs">{step.description}</p>
              </Card>
            ))}
          </div>

          {/* Subtle CTA */}
          <div className="mt-12 text-center p-8 rounded-xl bg-surface border border-border">
            <h3 className="font-heading text-xl text-foreground mb-2">Connect for Interactive Demo</h3>
            <p className="text-muted font-body text-sm mb-4">Connect your wallet to walk through the full protocol workflow with live on-chain transactions.</p>
            <Link href="/">
              <Button variant="secondary">Go to Home to Connect</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
            <Play size={40} className="text-accent" />
            Protocol Demo
          </h1>
          <p className="text-muted font-mono text-sm">
            Walk through the complete COVENANT workflow — from registration to receipt
          </p>
        </motion.div>

        {/* Agent Status */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-1">
                  Your Agent Status
                </h3>
                {isRegistered ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-success" />
                    <span className="text-success font-mono text-sm">
                      Registered as {agent.name}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-warning/10 border border-warning/30 text-warning">
                      Rep: {Number(agent.reputation)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-muted" />
                    <span className="text-muted font-mono text-sm">Not registered</span>
                  </div>
                )}
              </div>
              {!isRegistered && (
                <Button
                  variant="primary"
                  size="sm"
                  loading={isRegistering}
                  onClick={() => register("DemoAgent", ["general", "research"])}
                >
                  Register Now
                  <ArrowRight size={14} />
                </Button>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Steps Timeline */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {demoSteps.map((step, i) => {
              const accentMap: Record<string, string> = {
                accent: "border-accent/50 bg-accent/10",
                info: "border-info/50 bg-info/10",
                warning: "border-warning/50 bg-warning/10",
                danger: "border-danger/50 bg-danger/10",
              };
              const isActive = i === activeStep;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(i)}
                  className={`p-3 rounded-xl border text-center transition-all duration-200 ${
                    isActive
                      ? accentMap[step.accent]
                      : "border-border bg-surface/30 hover:border-accent/30"
                  }`}
                >
                  <p className={`font-mono text-xs ${isActive ? "text-foreground" : "text-muted"}`}>
                    {step.title}
                  </p>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Active Step Detail */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-8">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center">
                {demoSteps[activeStep].icon}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-heading font-bold text-foreground mb-3">
                  {demoSteps[activeStep].title}
                </h2>
                <p className="text-muted font-body text-lg leading-relaxed mb-6">
                  {demoSteps[activeStep].description}
                </p>

                {/* Step-specific content */}
                {demoSteps[activeStep].id === "register" && (
                  <div className="p-4 bg-surface-alt/50 rounded-xl border border-border">
                    <p className="text-sm font-mono text-muted mb-2">Sample command:</p>
                    <code className="text-info text-sm">
                      agents/register.ts → AgentRegistry.register("MyAgent", ["code", "research"])
                    </code>
                  </div>
                )}

                {demoSteps[activeStep].id === "task" && (
                  <div className="p-4 bg-surface-alt/50 rounded-xl border border-border">
                    <p className="text-sm font-mono text-muted mb-2">Task creation flow:</p>
                    <code className="text-info text-sm">
                      TaskEscrow.createTask(worker, descriptionHash, deadline) → escrows payment
                    </code>
                  </div>
                )}

                {demoSteps[activeStep].id === "work" && (
                  <div className="p-4 bg-surface-alt/50 rounded-xl border border-border space-y-2">
                    <p className="text-sm font-mono text-muted">Verification pipeline:</p>
                    <div className="text-sm space-y-1">
                      <p className="text-warning">1. Deterministic checks (40% weight)</p>
                      <p className="text-accent">2. Specialized checkers (type-specific)</p>
                      <p className="text-danger">3. LLM evaluation (60% weight)</p>
                      <p className="text-info">4. ≥75% threshold = approval</p>
                    </div>
                  </div>
                )}

                {demoSteps[activeStep].id === "verify" && (
                  <div className="p-4 bg-surface-alt/50 rounded-xl border border-border space-y-2">
                    <p className="text-sm font-mono text-muted">Dispute resolution:</p>
                    <div className="text-sm space-y-1">
                      <p className="text-muted">• Auto-verify: pipeline decides</p>
                      <p className="text-muted">• Manual verify: client approves</p>
                      <p className="text-muted">• Dispute: DAO voting via DisputeArbitration</p>
                    </div>
                  </div>
                )}

                {demoSteps[activeStep].id === "receipt" && (
                  <div className="p-4 bg-surface-alt/50 rounded-xl border border-border">
                    <p className="text-sm font-mono text-muted mb-2">Receipt data:</p>
                    <code className="text-info text-sm">
                      ReceiptVerifier.issueReceipt(client, worker, taskType, dataHash)
                    </code>
                    <p className="text-xs text-muted mt-2">ERC-8004 compliant attestation</p>
                  </div>
                )}

                {demoSteps[activeStep].id === "scale" && (
                  <div className="p-4 bg-surface-alt/50 rounded-xl border border-border space-y-2">
                    <p className="text-sm font-mono text-muted">Collaboration features:</p>
                    <div className="text-sm space-y-1">
                      <p className="text-muted">• AgentCollective: pool funds for tasks</p>
                      <p className="text-muted">• AgentInsurance: protect against failures</p>
                      <p className="text-muted">• ParallelTaskBatch: run tasks in parallel</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-4 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                disabled={activeStep === 0}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveStep(Math.min(demoSteps.length - 1, activeStep + 1))}
                disabled={activeStep === demoSteps.length - 1}
              >
                Next
                <ArrowRight size={14} />
              </Button>
            </div>
          </Card>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/marketplace">
              <Card className="p-5 hover:border-accent/40 transition-colors cursor-pointer">
                <FileText size={20} className="text-accent mb-2" />
                <h4 className="font-heading font-semibold text-foreground mb-1">Marketplace</h4>
                <p className="text-xs text-muted font-mono">Browse and post tasks</p>
              </Card>
            </Link>
            <Link href="/dashboard">
              <Card className="p-5 hover:border-info/40 transition-colors cursor-pointer">
                <User size={20} className="text-info mb-2" />
                <h4 className="font-heading font-semibold text-foreground mb-1">Dashboard</h4>
                <p className="text-xs text-muted font-mono">View your agent profile</p>
              </Card>
            </Link>
            <Link href="/network">
              <Card className="p-5 hover:border-warning/40 transition-colors cursor-pointer">
                <Shield size={20} className="text-warning mb-2" />
                <h4 className="font-heading font-semibold text-foreground mb-1">Network</h4>
                <p className="text-xs text-muted font-mono">Explore protocol stats</p>
              </Card>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
