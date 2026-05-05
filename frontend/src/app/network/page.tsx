"use client";

import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  GitBranch,
  LogIn,
  Activity,
  Globe,
  Server,
  Users,
  ArrowRight,
  Cpu,
  Layers,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { useAgentCount } from "@/hooks/useAgent";
import { useTaskCounter } from "@/hooks/useTask";
import { useReceiptCount } from "@/hooks/useReceipts";
import { useBatchCounter } from "@/hooks/useParallelBatch";
import { useDisputeCounter } from "@/hooks/useDisputeArbitration";
import { getContractAddresses } from "@/config/contracts";
import { useChainId } from "wagmi";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function NetworkPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const { data: agentCount, isLoading: agentsLoading } = useAgentCount();
  const { data: taskCountRaw, isLoading: tasksLoading } = useTaskCounter();
  const { data: receiptCountRaw, isLoading: receiptsLoading } = useReceiptCount();
  const { count: batchCount } = useBatchCounter();
  const { count: disputeCount } = useDisputeCounter();

  const taskCount = taskCountRaw as bigint | undefined;
  const receiptCount = receiptCountRaw as bigint | undefined;

  const networkName = chainId === 84532 ? "Base Sepolia" : chainId === 8453 ? "Base Mainnet" : `Chain ${chainId}`;

  if (!isConnected) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-10 max-w-md text-center" glowColor="cyan">
            <GitBranch size={48} className="text-biolum-cyan mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Network Overview
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to view COVENANT network statistics and contract status.
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

  const statCards = [
    {
      icon: <Users size={20} className="text-synapse-violet" />,
      label: "Registered Agents",
      value: agentCount !== undefined ? Number(agentCount) : undefined,
      color: "violet" as const,
    },
    {
      icon: <Activity size={20} className="text-biolum-cyan" />,
      label: "Total Tasks",
      value: taskCount !== undefined ? Number(taskCount) : undefined,
      color: "cyan" as const,
    },
    {
      icon: <Server size={20} className="text-neuron-gold" />,
      label: "Receipts Issued",
      value: receiptCount !== undefined ? Number(receiptCount) : undefined,
      color: "gold" as const,
    },
    {
      icon: <Layers size={20} className="text-plasma-pink" />,
      label: "Batches Created",
      value: batchCount !== undefined ? Number(batchCount) : undefined,
      color: "pink" as const,
    },
  ];

  const contractEntries = [
    { name: "AgentRegistry", address: contracts.AgentRegistry },
    { name: "TaskEscrow", address: contracts.TaskEscrow },
    { name: "ReceiptVerifier", address: contracts.ReceiptVerifier },
    { name: "OpenTaskMarket", address: contracts.OpenTaskMarket },
    { name: "ParallelTaskBatch", address: contracts.ParallelTaskBatch },
    { name: "AgentCollective", address: contracts.AgentCollective },
    { name: "AgentInsurance", address: contracts.AgentInsurance },
    { name: "DisputeArbitration", address: contracts.DisputeArbitration },
    { name: "CapabilityVerifier", address: contracts.CapabilityVerifier },
  ];

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
            <GitBranch size={40} className="text-biolum-cyan" />
            Network
          </h1>
          <p className="text-gray-400 font-mono text-sm flex items-center gap-2">
            <Globe size={14} />
            {networkName} &middot; Chain ID {chainId}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const glowMap = {
                violet: "border-synapse-violet/30",
                cyan: "border-biolum-cyan/30",
                gold: "border-neuron-gold/30",
                pink: "border-plasma-pink/30",
              };
              return (
                <GlassCard
                  key={card.label}
                  className={`p-4 ${glowMap[card.color]}`}
                  glowColor={card.color}
                >
                  <div className="mb-3">{card.icon}</div>
                  {card.value === undefined ? (
                    <div className="h-8 w-16 rounded-lg bg-glass animate-pulse" />
                  ) : (
                    <p className="text-3xl font-display font-bold text-white">
                      {card.value}
                    </p>
                  )}
                  <p className="text-gray-500 font-mono text-xs mt-1">{card.label}</p>
                </GlassCard>
              );
            })}
          </div>
        </motion.div>

        {/* Network Info */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="cyan">
            <h3 className="text-xl font-display font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu size={20} className="text-biolum-cyan" />
              Network Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between p-3 bg-glass/30 rounded-xl">
                <span className="text-gray-500 font-mono">Network</span>
                <span className="text-white font-mono">{networkName}</span>
              </div>
              <div className="flex justify-between p-3 bg-glass/30 rounded-xl">
                <span className="text-gray-500 font-mono">Chain ID</span>
                <span className="text-biolum-cyan font-mono">{chainId}</span>
              </div>
              <div className="flex justify-between p-3 bg-glass/30 rounded-xl">
                <span className="text-gray-500 font-mono">Disputes</span>
                <span className="text-plasma-pink font-mono">
                  {disputeCount !== undefined ? Number(disputeCount) : "---"}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-glass/30 rounded-xl">
                <span className="text-gray-500 font-mono">Your Address</span>
                <span className="text-white font-mono text-xs truncate max-w-[180px]">
                  {address}
                </span>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Contract Addresses */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-6" glowColor="violet">
            <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
              <Server size={20} className="text-synapse-violet" />
              Deployed Contracts
            </h3>
            <div className="space-y-2">
              {contractEntries.map((entry) => {
                const isZero = !entry.address || entry.address === "0x0000000000000000000000000000000000000000";
                return (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between px-4 py-3 bg-glass/30 border border-glass-border rounded-xl"
                  >
                    <span className="font-mono text-sm text-gray-300">{entry.name}</span>
                    {isZero ? (
                      <span className="font-mono text-xs text-gray-600">Not deployed</span>
                    ) : (
                      <span className="font-mono text-xs text-biolum-cyan truncate ml-4 max-w-[280px]">
                        {entry.address}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
