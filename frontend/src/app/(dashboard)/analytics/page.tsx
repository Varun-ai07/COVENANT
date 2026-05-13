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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
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

  // ---- Wallet not connected — rich preview ----
  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <BarChart3 size={40} className="text-accent" />
              Protocol Analytics
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Real-time on-chain metrics across the COVENANT network. Track agent registrations, task escrows, receipt issuances, insurance claims, batch operations, and dispute activity.
            </p>
          </div>

          {/* Stats preview grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {stats.map((stat) => (
              <AnalyticsStatCard key={stat.label} {...stat} />
            ))}
          </div>

          {/* Explanation cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center">
                  <Droplets size={20} className="text-warning" />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-foreground">Insurance Pool Balance</h3>
                  <p className="text-muted font-mono text-xs">collective risk pool</p>
                </div>
              </div>
              <p className="text-muted font-body text-sm">
                Shared pool backing insurance claims across all registered agents. Claims are voted on by pool members. The balance reflects total ETH deposited by all participants.
              </p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
                  <TrendingUp size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-heading font-bold text-foreground">Network Health</h3>
                  <p className="text-muted font-mono text-xs">protocol-wide summary</p>
                </div>
              </div>
              <p className="text-muted font-body text-sm">
                Derived metrics including agent density (tasks per agent), completion signal (receipts vs tasks), dispute rate, and batch utilization give a holistic view of protocol health.
              </p>
            </Card>
          </div>

          {/* Subtle CTA */}
          <div className="mt-12 text-center p-8 rounded-xl bg-surface border border-border">
            <h3 className="font-heading text-xl text-foreground mb-2">Connect for Full Access</h3>
            <p className="text-muted font-body text-sm mb-4">Connect your wallet to interact with the protocol.</p>
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
        className="max-w-7xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-10">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
            <BarChart3 size={40} className="text-accent" />
            Protocol Analytics
          </h1>
          <p className="text-muted font-mono text-sm">
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
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center">
                <Droplets size={20} className="text-warning" />
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-foreground">
                  Insurance Pool Balance
                </h3>
                <p className="text-muted font-mono text-xs">
                  collective risk pool
                </p>
              </div>
            </div>

            {poolLoading ? (
              <LoadingPulse lines={2} />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-heading font-bold text-warning">
                  {poolBalance !== undefined ? formatEth(poolBalance) : "0.0000"}
                </span>
                <span className="text-muted font-mono text-sm">ETH</span>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-muted font-body text-sm">
                Shared pool backing insurance claims across all registered agents.
                Claims are voted on by pool members.
              </p>
            </div>
          </Card>

          {/* Network Health Summary */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center">
                <TrendingUp size={20} className="text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-heading font-bold text-foreground">
                  Network Health
                </h3>
                <p className="text-muted font-mono text-xs">
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
                  color="text-accent"
                />
                <HealthRow
                  label="Completion Signal"
                  value={receiptCount !== undefined && taskCount !== undefined && taskCount > 0
                    ? `${((receiptCount / taskCount) * 100).toFixed(1)}%`
                    : "N/A"}
                  color="text-info"
                />
                <HealthRow
                  label="Dispute Rate"
                  value={disputesDisplay !== undefined && taskCount !== undefined && taskCount > 0
                    ? `${((disputesDisplay / taskCount) * 100).toFixed(2)}%`
                    : "N/A"}
                  color="text-danger"
                />
                <HealthRow
                  label="Batch Utilization"
                  value={batchesDisplay !== undefined
                    ? `${batchesDisplay} parallel batches`
                    : "N/A"}
                  color="text-warning"
                />
              </div>
            )}
          </Card>
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
    violet: "text-accent",
    cyan: "text-info",
    gold: "text-warning",
    pink: "text-danger",
  };

  const bgMap = {
    violet: "bg-accent/15 border-accent/30",
    cyan: "bg-info/15 border-info/30",
    gold: "bg-warning/15 border-warning/30",
    pink: "bg-danger/15 border-danger/30",
  };

  const borderHoverMap = {
    violet: "border-accent/30 hover:border-accent/60",
    cyan: "border-info/30 hover:border-info/60",
    gold: "border-warning/30 hover:border-warning/60",
    pink: "border-danger/30 hover:border-danger/60",
  };

  return (
    <Card
      className={`p-5 transition-all duration-300 ${borderHoverMap[color]}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl border flex items-center justify-center ${bgMap[color]}`}
        >
          <span className={iconColorMap[color]}>{icon}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="h-9 w-20 rounded-lg bg-surface-alt animate-pulse mb-2" />
      ) : (
        <p className="text-3xl font-heading font-bold text-foreground mb-1">
          {value !== undefined ? value.toLocaleString() : "—"}
        </p>
      )}

      <p className="text-muted font-mono text-xs font-medium">{label}</p>
      <p className="text-muted font-mono text-[10px]">{sublabel}</p>
    </Card>
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
      <span className="text-muted font-mono text-sm">{label}</span>
      <span className={`font-mono text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}
