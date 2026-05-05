"use client";

import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import {
  BarChart3,
  Users,
  FileText,
  Shield,
  TrendingUp,
  Activity,
  Layers,
  Gavel,
  Droplets,
  LogIn,
} from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { useAgentCount } from "@/hooks/useAgent";
import { useTaskCounter } from "@/hooks/useTask";
import { useReceiptCount } from "@/hooks/useReceipts";
import {
  useInsuranceClaimCount,
  useInsurancePoolBalance,
} from "@/hooks/useAgentInsurance";
import { useBatchCounter } from "@/hooks/useParallelBatch";
import { useDisputeCounter } from "@/hooks/useDisputeArbitration";
import { formatEth } from "@/types";

/* ─────────────────────── Animation Variants ─────────────────────── */

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/* ─────────────────────── Stat Card Config ───────────────────────── */

interface StatConfig {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  color: "violet" | "cyan" | "gold" | "pink";
  value: string | number | undefined;
  isLoading: boolean;
}

/* ─────────────────────────── Page ───────────────────────────────── */

export default function AnalyticsPage() {
  const { isConnected } = useAccount();

  // --- Protocol-wide on-chain reads ---
  const {
    data: agentCountRaw,
    isLoading: agentLoading,
  } = useAgentCount();

  const {
    data: taskCountRaw,
    isLoading: taskLoading,
  } = useTaskCounter();

  const {
    data: receiptCountRaw,
    isLoading: receiptLoading,
  } = useReceiptCount();

  const {
    count: claimCount,
    isLoading: claimLoading,
  } = useInsuranceClaimCount();

  const {
    count: batchCount,
    isLoading: batchLoading,
  } = useBatchCounter();

  const {
    count: disputeCount,
    isLoading: disputeLoading,
  } = useDisputeCounter();

  const {
    balance: poolBalance,
    isLoading: poolLoading,
  } = useInsurancePoolBalance();

  // Resolve bigint → number for display
  const agentCount = agentCountRaw !== undefined ? Number(agentCountRaw) : undefined;
  const taskCount = taskCountRaw !== undefined ? Number(taskCountRaw) : undefined;
  const receiptCount = receiptCountRaw !== undefined ? Number(receiptCountRaw) : undefined;
  const claimsDisplay = claimCount !== undefined ? Number(claimCount) : undefined;
  const batchesDisplay = batchCount !== undefined ? Number(batchCount) : undefined;
  const disputesDisplay = disputeCount !== undefined ? Number(disputeCount) : undefined;

  const stats: StatConfig[] = [
    {
      icon: <Users size={22} />,
      label: "Total Agents",
      sublabel: "registered on-chain",
      color: "violet",
      value: agentCount,
      isLoading: agentLoading,
    },
    {
      icon: <FileText size={22} />,
      label: "Total Tasks",
      sublabel: "escrow contracts",
      color: "cyan",
      value: taskCount,
      isLoading: taskLoading,
    },
    {
      icon: <Shield size={22} />,
      label: "Total Receipts",
      sublabel: "ERC-8004 attestations",
      color: "gold",
      value: receiptCount,
      isLoading: receiptLoading,
    },
    {
      icon: <Activity size={22} />,
      label: "Insurance Claims",
      sublabel: "pool activity",
      color: "pink",
      value: claimsDisplay,
      isLoading: claimLoading,
    },
    {
      icon: <Layers size={22} />,
      label: "Total Batches",
      sublabel: "parallel execution",
      color: "cyan",
      value: batchesDisplay,
      isLoading: batchLoading,
    },
    {
      icon: <Gavel size={22} />,
      label: "Total Disputes",
      sublabel: "arbitration events",
      color: "violet",
      value: disputesDisplay,
      isLoading: disputeLoading,
    },
  ];

  // ---- Wallet not connected ----
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
              Connect Your Wallet
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to view COVENANT protocol analytics and on-chain metrics.
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
        className="max-w-7xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-10">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <BarChart3 size={40} className="text-synapse-violet" />
            Protocol Analytics
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            Real-time on-chain metrics across the COVENANT network
          </p>
        </motion.div>

        {/* Stats Grid — 3x2 on large, 2x3 on small */}
        <motion.div variants={itemVariants} className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {stats.map((stat) => (
              <AnalyticsStatCard key={stat.label} {...stat} />
            ))}
          </div>
        </motion.div>

        {/* Pool Balance & Activity Summary Row */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Insurance Pool Balance */}
          <GlassCard className="p-6" glowColor="gold">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-neuron-gold/15 border border-neuron-gold/30 flex items-center justify-center">
                <Droplets size={20} className="text-neuron-gold" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-white">
                  Insurance Pool Balance
                </h3>
                <p className="text-gray-500 font-mono text-xs">
                  collective risk pool
                </p>
              </div>
            </div>

            {poolLoading ? (
              <LoadingPulse lines={2} />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-display font-bold text-neuron-gold">
                  {poolBalance !== undefined ? formatEth(poolBalance) : "0.0000"}
                </span>
                <span className="text-gray-400 font-mono text-sm">ETH</span>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-glass-border">
              <p className="text-gray-500 font-body text-sm">
                Shared pool backing insurance claims across all registered agents.
                Claims are voted on by pool members.
              </p>
            </div>
          </GlassCard>

          {/* Network Health Summary */}
          <GlassCard className="p-6" glowColor="violet">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-synapse-violet/15 border border-synapse-violet/30 flex items-center justify-center">
                <TrendingUp size={20} className="text-synapse-violet" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-white">
                  Network Health
                </h3>
                <p className="text-gray-500 font-mono text-xs">
                  protocol-wide summary
                </p>
              </div>
            </div>

            {agentLoading || taskLoading || receiptLoading ? (
              <LoadingPulse lines={4} />
            ) : (
              <div className="space-y-4">
                <HealthRow
                  label="Agent Density"
                  value={agentCount !== undefined && taskCount !== undefined && agentCount > 0
                    ? `${(taskCount / agentCount).toFixed(1)} tasks / agent`
                    : "N/A"}
                  color="text-synapse-violet"
                />
                <HealthRow
                  label="Completion Signal"
                  value={receiptCount !== undefined && taskCount !== undefined && taskCount > 0
                    ? `${((receiptCount / taskCount) * 100).toFixed(1)}%`
                    : "N/A"}
                  color="text-biolum-cyan"
                />
                <HealthRow
                  label="Dispute Rate"
                  value={disputesDisplay !== undefined && taskCount !== undefined && taskCount > 0
                    ? `${((disputesDisplay / taskCount) * 100).toFixed(2)}%`
                    : "N/A"}
                  color="text-plasma-pink"
                />
                <HealthRow
                  label="Batch Utilization"
                  value={batchesDisplay !== undefined
                    ? `${batchesDisplay} parallel batches`
                    : "N/A"}
                  color="text-neuron-gold"
                />
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function AnalyticsStatCard({
  icon,
  label,
  sublabel,
  color,
  value,
  isLoading,
}: StatConfig) {
  const iconColorMap = {
    violet: "text-synapse-violet",
    cyan: "text-biolum-cyan",
    gold: "text-neuron-gold",
    pink: "text-plasma-pink",
  };

  const bgMap = {
    violet: "bg-synapse-violet/15 border-synapse-violet/30",
    cyan: "bg-biolum-cyan/15 border-biolum-cyan/30",
    gold: "bg-neuron-gold/15 border-neuron-gold/30",
    pink: "bg-plasma-pink/15 border-plasma-pink/30",
  };

  const borderHoverMap = {
    violet: "border-synapse-violet/30 hover:border-synapse-violet/60",
    cyan: "border-biolum-cyan/30 hover:border-biolum-cyan/60",
    gold: "border-neuron-gold/30 hover:border-neuron-gold/60",
    pink: "border-plasma-pink/30 hover:border-plasma-pink/60",
  };

  return (
    <GlassCard
      className={`p-5 transition-all duration-300 ${borderHoverMap[color]}`}
      glowColor={color}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bgMap[color]}`}
        >
          <span className={iconColorMap[color]}>{icon}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-9 w-20 rounded-lg bg-glass animate-pulse mb-2" />
      ) : (
        <p className="text-3xl font-display font-bold text-white mb-1">
          {value !== undefined ? value.toLocaleString() : "—"}
        </p>
      )}

      <p className="text-gray-300 font-mono text-xs font-medium">{label}</p>
      <p className="text-gray-600 font-mono text-[10px]">{sublabel}</p>
    </GlassCard>
  );
}

function HealthRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-400 font-mono text-sm">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
