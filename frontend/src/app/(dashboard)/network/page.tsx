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
  Network,
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
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function NetworkPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const { data: agentCount, isLoading: agentsLoading } = useAgentCount();
  const { data: taskCountRaw, isLoading: tasksLoading } = useTaskCounter();
  const { data: receiptCountRaw, isLoading: receiptsLoading } =
    useReceiptCount();
  const { count: batchCount } = useBatchCounter();
  const { count: disputeCount } = useDisputeCounter();

  const taskCount = taskCountRaw as bigint | undefined;
  const receiptCount = receiptCountRaw as bigint | undefined;

  const networkName =
    chainId === 84532 ? "Base Sepolia" : chainId === 8453 ? "Base Mainnet" : `Chain ${chainId}`;

  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Decorative accent line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-24 h-[2px] bg-gradient-to-r from-info to-transparent mb-6"
          />
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-4 leading-tight flex items-center gap-3">
              <GitBranch size={40} className="text-info" />
              Network
            </h1>
            <p className="text-lg text-muted max-w-2xl font-body leading-relaxed">
              Explore the COVENANT protocol network. View on-chain statistics,
              deployed contract addresses, chain information, and real-time
              activity metrics.
            </p>
          </div>

          {/* Stats preview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-4 border-accent/30 backdrop-blur-sm bg-surface/60">
                <Users size={20} className="text-accent mb-3" />
                <p className="text-3xl font-heading font-bold text-white">
                  ---
                </p>
                <p className="text-muted font-mono text-xs mt-1">
                  Registered Agents
                </p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <Card className="p-4 border-info/30 backdrop-blur-sm bg-surface/60">
                <Activity size={20} className="text-info mb-3" />
                <p className="text-3xl font-heading font-bold text-white">
                  ---
                </p>
                <p className="text-muted font-mono text-xs mt-1">
                  Total Tasks
                </p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16 }}
            >
              <Card className="p-4 border-warning/30 backdrop-blur-sm bg-surface/60">
                <Server size={20} className="text-warning mb-3" />
                <p className="text-3xl font-heading font-bold text-white">
                  ---
                </p>
                <p className="text-muted font-mono text-xs mt-1">
                  Receipts Issued
                </p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.24 }}
            >
              <Card className="p-4 border-danger/30 backdrop-blur-sm bg-surface/60">
                <Layers size={20} className="text-danger mb-3" />
                <p className="text-3xl font-heading font-bold text-white">
                  ---
                </p>
                <p className="text-muted font-mono text-xs mt-1">
                  Batches Created
                </p>
              </Card>
            </motion.div>
          </div>

          {/* Network info explanation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="p-6 mb-8 backdrop-blur-sm bg-surface/70">
              <h3 className="text-xl font-heading font-semibold text-white mb-4 flex items-center gap-2">
                <Cpu size={20} className="text-info" />
                Network Information
              </h3>
              <p className="text-muted font-body text-sm mb-4">
                COVENANT deploys 9 smart contracts on Base Sepolia (L2). The
                network page shows live chain data, contract addresses, dispute
                counts, and your connected address — all pulled directly from
                on-chain reads.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl hover:bg-surface-alt/50 transition-colors duration-300">
                  <span className="text-muted font-mono">Network</span>
                  <span className="text-foreground font-mono">
                    Base Sepolia
                  </span>
                </div>
                <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl hover:bg-surface-alt/50 transition-colors duration-300">
                  <span className="text-muted font-mono">Chain ID</span>
                  <span className="text-info font-mono">84532</span>
                </div>
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
        {/* Decorative accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-24 h-[2px] bg-gradient-to-r from-info to-transparent mb-6"
        />
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-2 leading-tight flex items-center gap-3">
            <GitBranch size={40} className="text-info" />
            Network
          </h1>
          <p className="text-lg text-muted max-w-2xl mb-12 font-body leading-relaxed">
            {networkName} &middot; Chain ID {chainId}
          </p>
        </motion.div>

        {/* Quick Access to Graph */}
        <motion.div variants={itemVariants} className="mb-6">
          <Link href="/network/graph">
            <Card className="p-5 border-info/30 hover:border-info/50 transition-all duration-300 cursor-pointer group backdrop-blur-sm bg-surface/70">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-info/10 rounded-xl">
                    <Network size={24} className="text-info" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-white">
                      Interactive Agent Network Graph
                    </h3>
                    <p className="text-muted text-sm font-body">
                      Visualize agent-task relationships with D3.js force
                      simulation
                    </p>
                  </div>
                </div>
                <ArrowRight
                  size={20}
                  className="text-muted group-hover:text-info transition-colors duration-200"
                />
              </div>
            </Card>
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const glowMap = {
                violet: "border-accent/30 hover:border-accent/50",
                cyan: "border-info/30 hover:border-info/50",
                gold: "border-warning/30 hover:border-warning/50",
                pink: "border-danger/30 hover:border-danger/50",
              };
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                >
                  <Card
                    className={`p-4 ${glowMap[card.color]} backdrop-blur-sm bg-surface/60`}
                  >
                    <div className="mb-3">{card.icon}</div>
                    {card.value === undefined ? (
                      <div className="h-8 w-16 rounded-lg bg-surface-alt animate-pulse" />
                    ) : (
                      <p className="text-3xl font-heading font-bold text-white">
                        {card.value}
                      </p>
                    )}
                    <p className="text-muted font-mono text-xs mt-1">
                      {card.label}
                    </p>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Network Info */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6 backdrop-blur-sm bg-surface/70">
            <h3 className="text-xl font-heading font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu size={20} className="text-info" />
              Network Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl hover:bg-surface-alt/50 transition-colors duration-300">
                <span className="text-muted font-mono">Network</span>
                <span className="text-foreground font-mono">{networkName}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl hover:bg-surface-alt/50 transition-colors duration-300">
                <span className="text-muted font-mono">Chain ID</span>
                <span className="text-info font-mono">{chainId}</span>
              </div>
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl hover:bg-surface-alt/50 transition-colors duration-300">
                <span className="text-muted font-mono">Disputes</span>
                <span className="text-danger font-mono">
                  {disputeCount !== undefined ? Number(disputeCount) : "---"}
                </span>
              </div>
              <div className="flex justify-between p-3 bg-surface-alt/30 rounded-xl hover:bg-surface-alt/50 transition-colors duration-300">
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
          <Card className="p-6 backdrop-blur-sm bg-surface/70">
            <h3 className="text-xl font-heading font-semibold text-white mb-6 flex items-center gap-2">
              <Server size={20} className="text-accent" />
              Deployed Contracts
            </h3>
            <div className="space-y-2">
              {contractEntries.map((entry) => {
                const isZero =
                  !entry.address ||
                  entry.address ===
                    "0x0000000000000000000000000000000000000000";
                return (
                  <motion.div
                    key={entry.name}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-between px-4 py-3 bg-surface-alt/30 border border-border/50 rounded-xl hover:border-accent/30 transition-colors duration-300"
                  >
                    <span className="font-mono text-sm text-muted">
                      {entry.name}
                    </span>
                    {isZero ? (
                      <span className="font-mono text-xs text-muted">
                        Not deployed
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-info truncate ml-4 max-w-[280px]">
                        {entry.address}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}