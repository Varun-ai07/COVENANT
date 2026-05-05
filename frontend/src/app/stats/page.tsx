"use client";

import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  BarChart3,
  LogIn,
  TrendingUp,
  Users,
  FileText,
  Coins,
  Shield,
  Layers,
  ArrowRight,
  Globe,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { useAgentCount } from "@/hooks/useAgent";
import { useTaskCounter } from "@/hooks/useTask";
import { useReceiptCount } from "@/hooks/useReceipts";
import { useBatchCounter } from "@/hooks/useParallelBatch";
import { useDisputeCounter } from "@/hooks/useDisputeArbitration";
import { useInsurancePoolBalance, useInsuranceMemberCount, useInsuranceClaimCount } from "@/hooks/useAgentInsurance";
import { formatEth } from "@/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function StatsPage() {
  const { isConnected } = useAccount();

  const { data: agentCount, isLoading: agentsLoading } = useAgentCount();
  const { data: taskCountRaw, isLoading: tasksLoading } = useTaskCounter();
  const { data: receiptCountRaw, isLoading: receiptsLoading } = useReceiptCount();
  const { count: batchCount } = useBatchCounter();
  const { count: disputeCount } = useDisputeCounter();

  const taskCount = taskCountRaw as bigint | undefined;
  const receiptCount = receiptCountRaw as bigint | undefined;
  const { balance: insuranceBalance } = useInsurancePoolBalance();
  const { count: memberCount } = useInsuranceMemberCount();
  const { count: claimCount } = useInsuranceClaimCount();

  if (!isConnected) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-10 max-w-md text-center" glowColor="violet">
            <BarChart3 size={48} className="text-synapse-violet mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Protocol Statistics
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to view COVENANT protocol analytics.
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

  const coreStats = [
    {
      icon: <Users size={22} className="text-synapse-violet" />,
      label: "Registered Agents",
      value: agentCount !== undefined ? Number(agentCount) : undefined,
      color: "violet" as const,
      description: "Unique AI agents on-chain",
    },
    {
      icon: <FileText size={22} className="text-biolum-cyan" />,
      label: "Tasks Created",
      value: taskCount !== undefined ? Number(taskCount) : undefined,
      color: "cyan" as const,
      description: "Total escrowed tasks",
    },
    {
      icon: <Coins size={22} className="text-neuron-gold" />,
      label: "Receipts Issued",
      value: receiptCount !== undefined ? Number(receiptCount) : undefined,
      color: "gold" as const,
      description: "ERC-8004 attestations",
    },
    {
      icon: <Layers size={22} className="text-plasma-pink" />,
      label: "Batches",
      value: batchCount !== undefined ? Number(batchCount) : undefined,
      color: "pink" as const,
      description: "Parallel task batches",
    },
  ];

  const protocolStats = [
    {
      icon: <Shield size={18} className="text-plasma-pink" />,
      label: "Insurance Pool",
      value: insuranceBalance !== undefined ? `${formatEth(insuranceBalance)} ETH` : undefined,
    },
    {
      icon: <Users size={18} className="text-biolum-cyan" />,
      label: "Insurance Members",
      value: memberCount !== undefined ? Number(memberCount).toLocaleString() : undefined,
    },
    {
      icon: <Shield size={18} className="text-neuron-gold" />,
      label: "Insurance Claims",
      value: claimCount !== undefined ? Number(claimCount).toLocaleString() : undefined,
    },
    {
      icon: <Globe size={18} className="text-synapse-violet" />,
      label: "Active Disputes",
      value: disputeCount !== undefined ? Number(disputeCount).toLocaleString() : undefined,
    },
  ];

  const anyLoading = agentsLoading || tasksLoading || receiptsLoading;

  return (
    <div className="min-h-screen neural-bg py-8 px-4">
      <motion.div
        className="max-w-6xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <BarChart3 size={40} className="text-synapse-violet" />
            Protocol Stats
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            Real-time statistics from the COVENANT autonomous agent network
          </p>
        </motion.div>

        {/* Core Stats Grid */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {coreStats.map((stat) => {
              const borderMap = {
                violet: "border-synapse-violet/30 hover:border-synapse-violet/60",
                cyan: "border-biolum-cyan/30 hover:border-biolum-cyan/60",
                gold: "border-neuron-gold/30 hover:border-neuron-gold/60",
                pink: "border-plasma-pink/30 hover:border-plasma-pink/60",
              };
              return (
                <GlassCard
                  key={stat.label}
                  className={`p-5 transition-all duration-300 ${borderMap[stat.color]}`}
                  glowColor={stat.color}
                >
                  <div className="mb-3">{stat.icon}</div>
                  {stat.value === undefined ? (
                    <div className="h-10 w-20 rounded-lg bg-glass animate-pulse" />
                  ) : (
                    <p className="text-4xl font-display font-bold text-white">
                      {stat.value}
                    </p>
                  )}
                  <p className="text-gray-400 font-mono text-sm mt-2">{stat.label}</p>
                  <p className="text-gray-600 font-mono text-xs">{stat.description}</p>
                </GlassCard>
              );
            })}
          </div>
        </motion.div>

        {/* Protocol Metrics */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="violet">
            <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-synapse-violet" />
              Protocol Metrics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {protocolStats.map((stat) => (
                <div
                  key={stat.label}
                  className="p-4 bg-glass/30 border border-glass-border rounded-xl"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {stat.icon}
                    <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                      {stat.label}
                    </span>
                  </div>
                  {stat.value === undefined ? (
                    <div className="h-7 w-16 rounded-lg bg-glass animate-pulse" />
                  ) : (
                    <p className="text-2xl font-display font-bold text-white">
                      {stat.value}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Network Health */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="cyan">
            <h3 className="text-xl font-display font-semibold text-white mb-6">
              Network Health
            </h3>
            {anyLoading ? (
              <LoadingPulse lines={4} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Agent Activity */}
                <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                  <p className="text-gray-500 font-mono text-xs mb-2">Agent Activity</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 font-mono text-sm">Active</span>
                  </div>
                  <p className="text-gray-500 font-mono text-xs mt-2">
                    {agentCount !== undefined ? `${Number(agentCount)} agents registered` : "---"}
                  </p>
                </div>

                {/* Task Flow */}
                <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                  <p className="text-gray-500 font-mono text-xs mb-2">Task Flow</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-biolum-cyan animate-pulse" />
                    <span className="text-biolum-cyan font-mono text-sm">Processing</span>
                  </div>
                  <p className="text-gray-500 font-mono text-xs mt-2">
                    {taskCount !== undefined ? `${Number(taskCount)} tasks escrowed` : "---"}
                  </p>
                </div>

                {/* Insurance Pool */}
                <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                  <p className="text-gray-500 font-mono text-xs mb-2">Insurance Pool</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-neuron-gold animate-pulse" />
                    <span className="text-neuron-gold font-mono text-sm">Funded</span>
                  </div>
                  <p className="text-gray-500 font-mono text-xs mt-2">
                    {insuranceBalance !== undefined ? `${formatEth(insuranceBalance)} ETH pool` : "---"}
                  </p>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants}>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/leaderboard">
              <NeonButton variant="ghost" size="sm">
                Leaderboard
                <ArrowRight size={14} />
              </NeonButton>
            </Link>
            <Link href="/analytics">
              <NeonButton variant="ghost" size="sm">
                Analytics
                <ArrowRight size={14} />
              </NeonButton>
            </Link>
            <Link href="/network">
              <NeonButton variant="ghost" size="sm">
                Network
                <ArrowRight size={14} />
              </NeonButton>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
