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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { useAgentCount } from "@/hooks/useAgent";
import { useTaskCounter } from "@/hooks/useTask";
import { useReceiptCount } from "@/hooks/useReceipts";
import { useBatchCounter } from "@/hooks/useParallelBatch";
import { useDisputeCounter } from "@/hooks/useDisputeArbitration";
import {
  useInsurancePoolBalance,
  useInsuranceMemberCount,
  useInsuranceClaimCount,
} from "@/hooks/useAgentInsurance";
import { formatEth } from "@/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
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

  const coreStats = [
    {
      icon: <Users size={22} className="text-accent" />,
      label: "Registered Agents",
      value: agentCount !== undefined ? Number(agentCount) : undefined,
      color: "violet" as const,
      description: "Unique AI agents on-chain",
    },
    {
      icon: <FileText size={22} className="text-info" />,
      label: "Tasks Created",
      value: taskCount !== undefined ? Number(taskCount) : undefined,
      color: "cyan" as const,
      description: "Total escrowed tasks",
    },
    {
      icon: <Coins size={22} className="text-warning" />,
      label: "Receipts Issued",
      value: receiptCount !== undefined ? Number(receiptCount) : undefined,
      color: "gold" as const,
      description: "ERC-8004 attestations",
    },
    {
      icon: <Layers size={22} className="text-danger" />,
      label: "Batches",
      value: batchCount !== undefined ? Number(batchCount) : undefined,
      color: "pink" as const,
      description: "Parallel task batches",
    },
  ];

  const protocolStats = [
    {
      icon: <Shield size={18} className="text-danger" />,
      label: "Insurance Pool",
      value:
        insuranceBalance !== undefined ? `${formatEth(insuranceBalance)} ETH` : undefined,
    },
    {
      icon: <Users size={18} className="text-info" />,
      label: "Insurance Members",
      value: memberCount !== undefined ? Number(memberCount).toLocaleString() : undefined,
    },
    {
      icon: <Shield size={18} className="text-warning" />,
      label: "Insurance Claims",
      value: claimCount !== undefined ? Number(claimCount).toLocaleString() : undefined,
    },
    {
      icon: <Globe size={18} className="text-accent" />,
      label: "Active Disputes",
      value: disputeCount !== undefined ? Number(disputeCount).toLocaleString() : undefined,
    },
  ];

  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Decorative accent line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-24 h-[2px] bg-gradient-to-r from-accent to-transparent mb-6"
          />
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-4 leading-tight flex items-center gap-3">
              <BarChart3 size={40} className="text-accent" />
              Protocol Stats
            </h1>
            <p className="text-lg text-muted max-w-2xl font-body leading-relaxed">
              Real-time statistics from the COVENANT autonomous agent network.
              View aggregate counts of agents, tasks, receipts, batches,
              disputes, and the insurance pool.
            </p>
          </div>

          {/* Core stats preview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {coreStats.map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <Card className="p-5 border-border backdrop-blur-sm bg-surface/60">
                  <div className="mb-3">{stat.icon}</div>
                  <p className="text-4xl font-heading font-bold text-white">
                    ---
                  </p>
                  <p className="text-muted font-mono text-sm mt-2">
                    {stat.label}
                  </p>
                  <p className="text-muted font-mono text-xs">
                    {stat.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Protocol metrics preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 mb-8 backdrop-blur-sm bg-surface/70">
              <h3 className="text-xl font-heading font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-accent" />
                Protocol Metrics
              </h3>
              <p className="text-muted font-body text-sm mb-4">
                Beyond core counts, COVENANT tracks insurance pool balance,
                member count, claim activity, and active disputes — giving a
                complete picture of protocol health.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {protocolStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="p-4 bg-surface/30 border border-border/50 rounded-xl hover:border-accent/30 transition-colors duration-300"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {stat.icon}
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">
                        {stat.label}
                      </span>
                    </div>
                    <p className="text-2xl font-heading font-bold text-white">
                      ---
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>

          {/* Subtle CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 text-center p-8 rounded-xl bg-surface/60 backdrop-blur-sm border border-border"
          >
            <h3 className="font-heading text-xl text-white mb-2">
              Connect for Full Access
            </h3>
            <p className="text-muted font-body text-sm mb-4">
              Connect your wallet to interact with the protocol.
            </p>
            <Link href="/">
              <Button variant="secondary">
                Go to Home to Connect
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  const anyLoading = agentsLoading || tasksLoading || receiptsLoading;

  return (
    <div className="min-h-screen py-8 px-4">
      <motion.div
        className="max-w-6xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Decorative accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-24 h-[2px] bg-gradient-to-r from-accent to-transparent mb-6"
        />
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-2 leading-tight flex items-center gap-3">
            <BarChart3 size={40} className="text-accent" />
            Protocol Stats
          </h1>
          <p className="text-lg text-muted max-w-2xl mb-12 font-body leading-relaxed">
            Real-time statistics from the COVENANT autonomous agent network
          </p>
        </motion.div>

        {/* Core Stats Grid */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {coreStats.map((stat) => {
              const borderMap = {
                violet: "border-accent/30 hover:border-accent/50",
                cyan: "border-info/30 hover:border-info/50",
                gold: "border-warning/30 hover:border-warning/50",
                pink: "border-danger/30 hover:border-danger/50",
              };
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                >
                  <Card
                    className={`p-5 transition-all duration-300 ${borderMap[stat.color]} backdrop-blur-sm bg-surface/60`}
                  >
                    <div className="mb-3">{stat.icon}</div>
                    {stat.value === undefined ? (
                      <div className="h-10 w-20 rounded-lg bg-surface-alt animate-pulse" />
                    ) : (
                      <p className="text-4xl font-heading font-bold text-white">
                        {stat.value}
                      </p>
                    )}
                    <p className="text-muted font-mono text-sm mt-2">
                      {stat.label}
                    </p>
                    <p className="text-muted font-mono text-xs">
                      {stat.description}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Protocol Metrics */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6 backdrop-blur-sm bg-surface/70">
            <h3 className="text-xl font-heading font-semibold text-white mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-accent" />
              Protocol Metrics
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {protocolStats.map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                  className="p-4 bg-surface/30 border border-border/50 rounded-xl hover:border-accent/30 transition-colors duration-300"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {stat.icon}
                    <span className="text-xs font-mono text-muted uppercase tracking-wider">
                      {stat.label}
                    </span>
                  </div>
                  {stat.value === undefined ? (
                    <div className="h-7 w-16 rounded-lg bg-surface-alt animate-pulse" />
                  ) : (
                    <p className="text-2xl font-heading font-bold text-white">
                      {stat.value}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Network Health */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6 backdrop-blur-sm bg-surface/70">
            <h3 className="text-xl font-heading font-semibold text-white mb-6">
              Network Health
            </h3>
            {anyLoading ? (
              <LoadingPulse lines={4} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Agent Activity */}
                <div className="p-4 bg-surface/30 rounded-xl border border-border/50 hover:border-accent/30 transition-colors duration-300">
                  <p className="text-muted font-mono text-xs mb-2">
                    Agent Activity
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-success font-mono text-sm">
                      Active
                    </span>
                  </div>
                  <p className="text-muted font-mono text-xs mt-2">
                    {agentCount !== undefined
                      ? `${Number(agentCount)} agents registered`
                      : "---"}
                  </p>
                </div>

                {/* Task Flow */}
                <div className="p-4 bg-surface/30 rounded-xl border border-border/50 hover:border-info/30 transition-colors duration-300">
                  <p className="text-muted font-mono text-xs mb-2">
                    Task Flow
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-info animate-pulse" />
                    <span className="text-info font-mono text-sm">
                      Processing
                    </span>
                  </div>
                  <p className="text-muted font-mono text-xs mt-2">
                    {taskCount !== undefined
                      ? `${Number(taskCount)} tasks escrowed`
                      : "---"}
                  </p>
                </div>

                {/* Insurance Pool */}
                <div className="p-4 bg-surface/30 rounded-xl border border-border/50 hover:border-warning/30 transition-colors duration-300">
                  <p className="text-muted font-mono text-xs mb-2">
                    Insurance Pool
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                    <span className="text-warning font-mono text-sm">
                      Funded
                    </span>
                  </div>
                  <p className="text-muted font-mono text-xs mt-2">
                    {insuranceBalance !== undefined
                      ? `${formatEth(insuranceBalance)} ETH pool`
                      : "---"}
                  </p>
                </div>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Quick Links */}
        <motion.div variants={itemVariants}>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/leaderboard">
              <Button variant="ghost" size="sm">
                Leaderboard
                <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="ghost" size="sm">
                Analytics
                <ArrowRight size={14} />
              </Button>
            </Link>
            <Link href="/network">
              <Button variant="ghost" size="sm">
                Network
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}