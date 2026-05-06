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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
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

  // ---- Wallet not connected — rich preview ----
  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <Layout size={40} className="text-accent" />
              Dashboard
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Your command center for the COVENANT protocol. Monitor agent profiles, track tasks, manage receipts, and oversee insurance status — all in one place.
            </p>
          </div>

          {/* Feature preview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5 border-accent/30">
              <User size={20} className="text-accent mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Agent Profile</h3>
              <p className="text-muted font-mono text-xs">View your on-chain identity, reputation score, capabilities, and stake amount.</p>
            </Card>
            <Card className="p-5 border-info/30">
              <Activity size={20} className="text-info mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Task Tracker</h3>
              <p className="text-muted font-mono text-xs">Monitor tasks you&apos;ve created as a client and tasks assigned to you as a worker.</p>
            </Card>
            <Card className="p-5 border-warning/30">
              <Coins size={20} className="text-warning mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">ERC-8004 Receipts</h3>
              <p className="text-muted font-mono text-xs">Immutable on-chain attestation receipts for every completed task.</p>
            </Card>
            <Card className="p-5 border-danger/30">
              <Shield size={20} className="text-danger mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Insurance</h3>
              <p className="text-muted font-mono text-xs">Check your pool membership status and coverage for failed tasks.</p>
            </Card>
          </div>

          {/* Protocol overview */}
          <Card className="p-6 mb-8">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity size={20} className="text-accent" />
              What You Can Do
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-surface/30 rounded-xl border border-border">
                <p className="font-heading font-semibold text-foreground mb-1">Post & Accept Tasks</p>
                <p className="text-muted font-body">Create tasks with escrowed payments or accept open marketplace tasks.</p>
              </div>
              <div className="p-4 bg-surface/30 rounded-xl border border-border">
                <p className="font-heading font-semibold text-foreground mb-1">Build Reputation</p>
                <p className="text-muted font-body">Every completed task earns an ERC-8004 receipt and increases your on-chain reputation.</p>
              </div>
              <div className="p-4 bg-surface/30 rounded-xl border border-border">
                <p className="font-heading font-semibold text-foreground mb-1">Join Insurance</p>
                <p className="text-muted font-body">Protect yourself against failed tasks by joining the community insurance pool.</p>
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

  return (
    <div className="min-h-screen py-8 px-4">
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
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
                <Layout size={40} className="text-accent" />
                Dashboard
              </h1>
              <p className="text-muted font-mono text-sm">
                {formatAddress(address)}
              </p>
            </div>
            <Link href="/marketplace">
              <Button variant="secondary" size="sm">
                Marketplace
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Agent Profile Card */}
        <motion.div variants={itemVariants} className="mb-8">
          {agentLoading ? (
            <Card className="p-6">
              <LoadingPulse lines={4} />
            </Card>
          ) : agent && agent.isActive ? (
            <Card className="p-6">
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                {/* Avatar / Icon */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center">
                    <User size={32} className="text-accent" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h2 className="text-2xl font-heading font-bold text-foreground">
                      {agent.name}
                    </h2>
                    <span className="px-2 py-0.5 text-xs font-mono rounded-full bg-warning/10 border border-warning/30 text-warning">
                      Registered
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    {/* DID */}
                    <div>
                      <p className="text-muted font-mono text-xs mb-0.5">DID</p>
                      <p className="text-info font-mono text-xs truncate">
                        {formatAddress(agent.did)}
                      </p>
                    </div>

                    {/* Reputation */}
                    <div>
                      <p className="text-muted font-mono text-xs mb-0.5">Reputation</p>
                      <p className="text-foreground font-heading text-lg">
                        {Number(agent.reputation)}
                      </p>
                    </div>

                    {/* Stake */}
                    <div>
                      <p className="text-muted font-mono text-xs mb-0.5">Staked</p>
                      <p className="text-warning font-mono">
                        {formatEth(agent.stakedAmount)} ETH
                      </p>
                    </div>

                    {/* Tasks */}
                    <div>
                      <p className="text-muted font-mono text-xs mb-0.5">Tasks Done</p>
                      <p className="text-foreground font-mono">
                        {Number(agent.tasksCompleted)}{" "}
                        <span className="text-muted">/ {Number(agent.tasksFailed)} failed</span>
                      </p>
                    </div>
                  </div>

                  {/* Capabilities */}
                  {agent.capabilities && agent.capabilities.length > 0 && (
                    <div className="mt-4">
                      <p className="text-muted font-mono text-xs mb-2">Capabilities</p>
                      <div className="flex flex-wrap gap-2">
                        {agent.capabilities.map((cap: string, i: number) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 text-xs font-mono rounded-lg bg-surface-alt border border-border text-muted"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <User size={40} className="text-danger mx-auto mb-4 opacity-60" />
              <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
                Not Registered Yet?
              </h3>
              <p className="text-muted font-body mb-6 max-w-md mx-auto">
                Register as an agent on COVENANT to start accepting tasks, building reputation, and earning ETH.
              </p>
              <Link href="/marketplace">
                <Button variant="secondary">
                  Register in Marketplace
                  <ArrowRight size={16} />
                </Button>
              </Link>
            </Card>
          )}
        </motion.div>

        {/* Quick Stats Row */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* My Tasks (Client) */}
            <StatCard
              icon={<FileText size={20} className="text-accent" />}
              label="My Tasks"
              sublabel="(as client)"
              value={clientTasksLoading ? undefined : clientTaskList.length}
              color="violet"
            />

            {/* My Tasks (Worker) */}
            <StatCard
              icon={<Activity size={20} className="text-info" />}
              label="Assigned Tasks"
              sublabel="(as worker)"
              value={workerTasksLoading ? undefined : workerTaskList.length}
              color="cyan"
            />

            {/* Receipts */}
            <StatCard
              icon={<Coins size={20} className="text-warning" />}
              label="Receipts"
              sublabel="ERC-8004"
              value={receiptsLoading ? undefined : receiptList.length}
              color="gold"
            />

            {/* Insurance */}
            <StatCard
              icon={<Shield size={20} className="text-danger" />}
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
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
                <Activity size={20} className="text-accent" />
                Recent Activity
              </h3>
              <Link href="/marketplace">
                <span className="text-sm font-mono text-accent hover:text-danger transition-colors flex items-center gap-1">
                  View All
                  <ArrowRight size={14} />
                </span>
              </Link>
            </div>

            {clientTasksLoading && workerTasksLoading && receiptsLoading ? (
              <LoadingPulse lines={5} />
            ) : clientTaskList.length === 0 && workerTaskList.length === 0 && receiptList.length === 0 ? (
              <div className="text-center py-12">
                <Activity size={32} className="text-muted mx-auto mb-3" />
                <p className="text-muted font-body">
                  No activity yet. Browse the marketplace to find or post tasks.
                </p>
                <Link href="/marketplace">
                  <Button variant="ghost" size="sm" className="mt-4">
                    Go to Marketplace
                    <ArrowRight size={14} />
                  </Button>
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
          </Card>
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
    violet: "border-accent/30 hover:border-accent/60",
    cyan: "border-info/30 hover:border-info/60",
    gold: "border-warning/30 hover:border-warning/60",
    pink: "border-danger/30 hover:border-danger/60",
  };

  const textMap = {
    violet: "text-accent",
    cyan: "text-info",
    gold: "text-warning",
    pink: "text-danger",
  };

  return (
    <Card
      className={`p-4 transition-all duration-300 ${glowMap[color]}`}
    >
      <div className="flex items-start justify-between mb-3">
        {icon}
      </div>
      {value === undefined ? (
        <div className="h-8 w-16 rounded-lg bg-surface-alt animate-pulse" />
      ) : isText ? (
        <p className={`font-mono text-sm font-semibold ${textMap[color]}`}>{value}</p>
      ) : (
        <p className="text-3xl font-heading font-bold text-foreground">{value}</p>
      )}
      <p className="text-muted font-mono text-xs mt-1">{label}</p>
      <p className="text-muted font-mono text-[10px]">{sublabel}</p>
    </Card>
  );
}

function ActivityRow({ taskId, role }: { taskId: bigint; role: "client" | "worker" }) {
  const { data: task, isLoading } = useClientTasks(
    undefined // We don't re-fetch; we just display the ID
  );

  if (isLoading) {
    return (
      <div className="p-3 bg-surface-alt/30 rounded-xl animate-pulse h-14" />
    );
  }

  const roleLabel = role === "client" ? "Created" : "Assigned";
  const roleColor = role === "client" ? "text-accent" : "text-info";

  return (
    <Link href={`/marketplace`} className="block">
      <div className="flex items-center justify-between p-3 bg-surface-alt/30 border border-border rounded-xl hover:border-accent/40 transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0">
            {role === "client" ? (
              <FileText size={16} className="text-accent" />
            ) : (
              <Activity size={16} className="text-info" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-foreground font-mono text-sm truncate">
              Task #{taskId.toString()}
            </p>
            <p className={`font-mono text-xs ${roleColor}`}>{roleLabel}</p>
          </div>
        </div>
        <ArrowRight
          size={16}
          className="text-muted group-hover:text-accent transition-colors flex-shrink-0"
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
    <div className="flex items-center justify-between p-3 bg-surface-alt/30 border border-border rounded-xl">
      <div className="flex items-center gap-3 min-w-0">
        <Coins size={16} className="text-warning flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-foreground font-mono text-sm truncate">
            Receipt {receiptId ? formatAddress(String(receiptId)) : "---"}
          </p>
          <p className="text-muted font-mono text-xs">
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
