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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
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
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <GitBranch size={40} className="text-info" />
              Network
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Explore the COVENANT protocol network. View on-chain statistics, deployed contract addresses, chain information, and real-time activity metrics.
            </p>
          </div>

          {/* Stats preview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 border-accent/30">
              <Users size={20} className="text-accent mb-3" />
              <p className="text-3xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs mt-1">Registered Agents</p>
            </Card>
            <Card className="p-4 border-info/30">
              <Activity size={20} className="text-info mb-3" />
              <p className="text-3xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs mt-1">Total Tasks</p>
            </Card>
            <Card className="p-4 border-warning/30">
              <Server size={20} className="text-warning mb-3" />
              <p className="text-3xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs mt-1">Receipts Issued</p>
            </Card>
            <Card className="p-4 border-danger/30">
              <Layers size={20} className="text-danger mb-3" />
              <p className="text-3xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs mt-1">Batches Created</p>
            </Card>
          </div>

          {/* Network info explanation */}
          <Card className="p-6 mb-8">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Cpu size={20} className="text-info" />
              Network Information
            </h3>
            <p className="text-muted font-body text-sm mb-4">
              COVENANT deploys 9 smart contracts on Base Sepolia (L2). The network page shows live chain data, contract addresses, dispute counts, and your connected address — all pulled directly from on-chain reads.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl">
                <span className="text-muted font-mono">Network</span>
                <span className="text-foreground font-mono">Base Sepolia</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl">
                <span className="text-muted font-mono">Chain ID</span>
                <span className="text-info font-mono">84532</span>
              </div>
            </div>
          </Card>

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

  const statCards = [
    {
      icon: <Users size={20} className="text-accent" />,
      label: "Registered Agents",
      value: agentCount !== undefined ? Number(agentCount) : undefined,
      color: "violet" as const,
    },
    {
      icon: <Activity size={20} className="text-info" />,
      label: "Total Tasks",
      value: taskCount !== undefined ? Number(taskCount) : undefined,
      color: "cyan" as const,
    },
    {
      icon: <Server size={20} className="text-warning" />,
      label: "Receipts Issued",
      value: receiptCount !== undefined ? Number(receiptCount) : undefined,
      color: "gold" as const,
    },
    {
      icon: <Layers size={20} className="text-danger" />,
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
    <div className="min-h-screen py-8 px-4">
      <motion.div
        className="max-w-6xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
            <GitBranch size={40} className="text-info" />
            Network
          </h1>
          <p className="text-muted font-mono text-sm flex items-center gap-2">
            <Globe size={14} />
            {networkName} &middot; Chain ID {chainId}
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const glowMap = {
                violet: "border-accent/30",
                cyan: "border-info/30",
                gold: "border-warning/30",
                pink: "border-danger/30",
              };
              return (
                <Card
                  key={card.label}
                  className={`p-4 ${glowMap[card.color]}`}
                >
                  <div className="mb-3">{card.icon}</div>
                  {card.value === undefined ? (
                    <div className="h-8 w-16 rounded-lg bg-surface-alt animate-pulse" />
                  ) : (
                    <p className="text-3xl font-heading font-bold text-foreground">
                      {card.value}
                    </p>
                  )}
                  <p className="text-muted font-mono text-xs mt-1">{card.label}</p>
                </Card>
              );
            })}
          </div>
        </motion.div>

        {/* Network Info */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Cpu size={20} className="text-info" />
              Network Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl">
                <span className="text-muted font-mono">Network</span>
                <span className="text-foreground font-mono">{networkName}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl">
                <span className="text-muted font-mono">Chain ID</span>
                <span className="text-info font-mono">{chainId}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl">
                <span className="text-muted font-mono">Disputes</span>
                <span className="text-danger font-mono">
                  {disputeCount !== undefined ? Number(disputeCount) : "---"}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl">
                <span className="text-muted font-mono">Your Address</span>
                <span className="text-foreground font-mono text-xs truncate max-w-[180px]">
                  {address}
                </span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Contract Addresses */}
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
              <Server size={20} className="text-accent" />
              Deployed Contracts
            </h3>
            <div className="space-y-2">
              {contractEntries.map((entry) => {
                const isZero = !entry.address || entry.address === "0x0000000000000000000000000000000000000000";
                return (
                  <div
                    key={entry.name}
                    className="flex items-center justify-between px-4 py-3 bg-surface-alt/30 border border-border rounded-xl"
                  >
                    <span className="font-mono text-sm text-muted">{entry.name}</span>
                    {isZero ? (
                      <span className="font-mono text-xs text-muted">Not deployed</span>
                    ) : (
                      <span className="font-mono text-xs text-info truncate ml-4 max-w-[280px]">
                        {entry.address}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
