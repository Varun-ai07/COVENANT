"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import {
  Layout,
  User,
  FileText,
  Shield,
  Activity,
  ArrowRight,
  Coins,
  LogIn,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAgent, useAgentByAddress } from "@/hooks/useAgent";
import { useClientTasks, useWorkerTasks } from "@/hooks/useTask";
import { useInsuranceMemberInfo } from "@/hooks/useAgentInsurance";
import { useAgentReceipts } from "@/hooks/useReceipts";
import { formatAddress, formatEth } from "@/types";

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

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  // --- On-chain reads ---
  const { data: agentData, isLoading: agentLoading } = useAgent();
  const { data: clientTasks, isLoading: clientTasksLoading } = useClientTasks(address);
  const { data: workerTasks, isLoading: workerTasksLoading } = useWorkerTasks(address);
  const { data: insuranceInfo, isLoading: insuranceLoading } = useInsuranceMemberInfo(address);
  const { data: receipts, isLoading: receiptsLoading } = useAgentReceipts(address);

  const agent = agentData as any;
  const clientTaskList = (clientTasks as bigint[] | undefined) || [];
  const workerTaskList = (workerTasks as bigint[] | undefined) || [];
  const receiptList = (receipts as any[] | undefined) || [];

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
            <LogIn size={48} className="text-synapse-violet mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Connect Your Wallet
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to access the COVENANT dashboard and manage your agent profile, tasks, and receipts.
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
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
                <Layout size={40} className="text-synapse-violet" />
                Dashboard
              </h1>
              <p className="text-gray-400 font-mono text-sm">
                {formatAddress(address)}
              </p>
            </div>
            <Link href="/marketplace">
              <NeonButton variant="secondary" size="sm">
                Marketplace
                <ArrowRight size={14} />
              </NeonButton>
            </Link>
          </div>
        </motion.div>

        {/* Agent Profile Card */}
        <motion.div variants={itemVariants} className="mb-8">
          {agentLoading ? (
            <GlassCard className="p-6">
              <LoadingPulse lines={4} />
            </GlassCard>
          ) : agent && agent.isActive ? (
            <GlassCard className="p-6" glowColor="violet">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Avatar / Icon */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-synapse-violet/20 border border-synapse-violet/40 flex items-center justify-center">
                    <User size={32} className="text-synapse-violet" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h2 className="text-2xl font-display font-bold text-white">
                      {agent.name}
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-neuron-gold/10 border border-neuron-gold/30 text-neuron-gold">
                      Registered
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    {/* DID */}
                    <div>
                      <p className="text-gray-500 font-mono text-xs mb-0.5">DID</p>
                      <p className="text-biolum-cyan font-mono text-xs truncate">
                        {formatAddress(agent.did)}
                      </p>
                    </div>

                    {/* Reputation */}
                    <div>
                      <p className="text-gray-500 font-mono text-xs mb-0.5">Reputation</p>
                      <p className="text-white font-display text-lg">
                        {Number(agent.reputation)}
                      </p>
                    </div>

                    {/* Stake */}
                    <div>
                      <p className="text-gray-500 font-mono text-xs mb-0.5">Staked</p>
                      <p className="text-neuron-gold font-mono">
                        {formatEth(agent.stakedAmount)} ETH
                      </p>
                    </div>

                    {/* Tasks */}
                    <div>
                      <p className="text-gray-500 font-mono text-xs mb-0.5">Tasks Done</p>
                      <p className="text-white font-mono">
                        {Number(agent.tasksCompleted)}{" "}
                        <span className="text-gray-500">/ {Number(agent.tasksFailed)} failed</span>
                      </p>
                    </div>
                  </div>

                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="mt-4">
                      <p className="text-gray-500 font-mono text-xs mb-2">Capabilities</p>
                      <div className="flex flex-wrap gap-2">
                        {agent.capabilities.map((cap: string, i: number) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 text-xs font-mono rounded-lg bg-glass border border-glass-border text-gray-300"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-8 text-center" glowColor="pink">
              <User size={40} className="text-plasma-pink mx-auto mb-4 opacity-60" />
              <h3 className="text-xl font-display font-semibold text-white mb-2">
                Not Registered Yet?
              </h3>
              <p className="text-gray-400 font-body mb-6 max-w-md mx-auto">
                Register as an agent on COVENANT to start accepting tasks, building reputation, and earning ETH.
              </p>
              <Link href="/marketplace">
                <NeonButton variant="secondary">
                  Register in Marketplace
                  <ArrowRight size={16} />
                </NeonButton>
              </Link>
            </GlassCard>
          )}
        </motion.div>

        {/* Quick Stats Row */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* My Tasks (Client) */}
            <StatCard
              icon={<FileText size={20} className="text-synapse-violet" />}
              label="My Tasks"
              sublabel="(as client)"
              value={clientTasksLoading ? undefined : clientTaskList.length}
              color="violet"
            />

            {/* My Tasks (Worker) */}
            <StatCard
              icon={<Activity size={20} className="text-biolum-cyan" />}
              label="Assigned Tasks"
              sublabel="(as worker)"
              value={workerTasksLoading ? undefined : workerTaskList.length}
              color="cyan"
            />

            {/* Receipts */}
            <StatCard
              icon={<Coins size={20} className="text-neuron-gold" />}
              label="Receipts"
              sublabel="ERC-8004"
              value={receiptsLoading ? undefined : receiptList.length}
              color="gold"
            />

            {/* Insurance */}
            <StatCard
              icon={<Shield size={20} className="text-plasma-pink" />}
              label="Insurance"
              sublabel="pool status"
              value={
                insuranceLoading
                  ? undefined
                  : insuranceInfo?.isMember
                    ? "Member"
                    : "Not Member"
              }
              color="pink"
              isText
            />
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-6" glowColor="violet">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-semibold text-white flex items-center gap-2">
                <Activity size={20} className="text-synapse-violet" />
                Recent Activity
              </h3>
              <Link href="/marketplace">
                <span className="text-sm font-mono text-synapse-violet hover:text-plasma-pink transition-colors flex items-center gap-1">
                  View All
                  <ArrowRight size={14} />
                </span>
              </Link>
            </div>

            {clientTasksLoading && workerTasksLoading && receiptsLoading ? (
              <LoadingPulse lines={5} />
            ) : clientTaskList.length === 0 && workerTaskList.length === 0 && receiptList.length === 0 ? (
              <div className="text-center py-12">
                <Activity size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 font-body">
                  No activity yet. Browse the marketplace to find or post tasks.
                </p>
                <Link href="/marketplace">
                  <NeonButton variant="ghost" size="sm" className="mt-4">
                    Go to Marketplace
                    <ArrowRight size={14} />
                  </NeonButton>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Client tasks */}
                {clientTaskList.slice(0, 5).map((taskId: bigint) => (
                  <ActivityRow
                    key={`c-${taskId.toString()}`}
                    taskId={taskId}
                    role="client"
                  />
                ))}

                {/* Worker tasks */}
                {workerTaskList.slice(0, 5).map((taskId: bigint) => (
                  <ActivityRow
                    key={`w-${taskId.toString()}`}
                    taskId={taskId}
                    role="worker"
                  />
                ))}

                {/* Receipts */}
                {receiptList.slice(0, 5).map((receipt: any, idx: number) => (
                  <ReceiptRow key={`r-${idx}`} receipt={receipt} />
                ))}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ─────────────────────────────── Sub-components ─────────────────────────────── */

function StatCard({
  icon,
  label,
  sublabel,
  value,
  color,
  isText = false,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  value: number | string | undefined;
  color: "violet" | "cyan" | "gold" | "pink";
  isText?: boolean;
}) {
  const glowMap = {
    violet: "border-synapse-violet/30 hover:border-synapse-violet/60",
    cyan: "border-biolum-cyan/30 hover:border-biolum-cyan/60",
    gold: "border-neuron-gold/30 hover:border-neuron-gold/60",
    pink: "border-plasma-pink/30 hover:border-plasma-pink/60",
  };

  const textMap = {
    violet: "text-synapse-violet",
    cyan: "text-biolum-cyan",
    gold: "text-neuron-gold",
    pink: "text-plasma-pink",
  };

  return (
    <GlassCard
      className={`p-4 transition-all duration-300 ${glowMap[color]}`}
      glowColor={color}
    >
      <div className="flex items-start justify-between mb-3">
        {icon}
      </div>
      {value === undefined ? (
        <div className="h-8 w-16 rounded-lg bg-glass animate-pulse" />
      ) : isText ? (
        <p className={`font-mono text-sm font-semibold ${textMap[color]}`}>{value}</p>
      ) : (
        <p className="text-3xl font-display font-bold text-white">{value}</p>
      )}
      <p className="text-gray-500 font-mono text-xs mt-1">{label}</p>
      <p className="text-gray-600 font-mono text-[10px]">{sublabel}</p>
    </GlassCard>
  );
}

function ActivityRow({ taskId, role }: { taskId: bigint; role: "client" | "worker" }) {
  const { data: task, isLoading } = useClientTasks(
    undefined // We don't re-fetch; we just display the ID
  );

  if (isLoading) {
    return (
      <div className="p-3 bg-glass/30 rounded-xl animate-pulse h-14" />
    );
  }

  const roleLabel = role === "client" ? "Created" : "Assigned";
  const roleColor = role === "client" ? "text-synapse-violet" : "text-biolum-cyan";

  return (
    <Link href={`/marketplace`} className="block">
      <div className="flex items-center justify-between p-3 bg-glass/30 border border-glass-border rounded-xl hover:border-synapse-violet/40 transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {role === "client" ? (
              <FileText size={16} className="text-synapse-violet" />
            ) : (
              <Activity size={16} className="text-biolum-cyan" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-white font-mono text-sm truncate">
              Task #{taskId.toString()}
            </p>
            <p className={`font-mono text-xs ${roleColor}`}>{roleLabel}</p>
          </div>
        </div>
        <ArrowRight
          size={16}
          className="text-gray-600 group-hover:text-synapse-violet transition-colors flex-shrink-0"
        />
      </div>
    </Link>
  );
}

function ReceiptRow({ receipt }: { receipt: any }) {
  const receiptId = receipt?.receiptId || receipt?.[0];
  const timestamp = receipt?.timestamp || receipt?.[5];
  const isValid = receipt?.isValid ?? receipt?.[7];

  return (
    <div className="flex items-center justify-between p-3 bg-glass/30 border border-glass-border rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <Coins size={16} className="text-neuron-gold flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-white font-mono text-sm truncate">
            Receipt {receiptId ? formatAddress(String(receiptId)) : "---"}
          </p>
          <p className="text-gray-500 font-mono text-xs">
            {timestamp
              ? new Date(Number(timestamp) * 1000).toLocaleDateString()
              : "---"}
          </p>
        </div>
      </div>
      <StatusBadge
        status={isValid ? "completed" : "failed"}
        size="sm"
      />
    </div>
  );
}
