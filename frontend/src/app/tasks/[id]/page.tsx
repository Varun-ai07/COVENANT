"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  FileText,
  LogIn,
  ArrowRight,
  Clock,
  User,
  Coins,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Hash,
  Calendar,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useTask, useSubmitWork, useVerifyTask, useDisputeTask } from "@/hooks/useTask";
import { formatAddress, formatEth, TaskStatus, TASK_STATUS_LABELS } from "@/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params?.id ? Number(params.id) : undefined;
  const { address, isConnected } = useAccount();

  const { data: taskRaw, isLoading: taskLoading } = useTask(taskId !== undefined ? BigInt(taskId) : undefined);
  const { submitWork, isPending: isSubmitting } = useSubmitWork();
  const { verifyTask, isPending: isVerifying } = useVerifyTask();
  const { disputeTask, isPending: isDisputing } = useDisputeTask();

  const task = taskRaw as any[] | undefined;

  const client = task?.[0] as string | undefined;
  const worker = task?.[1] as string | undefined;
  const payment = task?.[2] as bigint | undefined;
  const deadline = task?.[3] as bigint | undefined;
  const descriptionHash = task?.[4] as string | undefined;
  const deliverableHash = task?.[5] as string | undefined;
  const status = task?.[6] !== undefined ? Number(task[6]) : undefined;
  const createdAt = task?.[7] as bigint | undefined;
  const completedAt = task?.[8] as bigint | undefined;

  const isClient = client?.toLowerCase() === address?.toLowerCase();
  const isWorker = worker?.toLowerCase() === address?.toLowerCase();

  if (!isConnected) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-10 max-w-md text-center" glowColor="cyan">
            <FileText size={48} className="text-biolum-cyan mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Task Details
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to view task details and actions.
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

  if (taskId === undefined) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <GlassCard className="p-10 max-w-md text-center" glowColor="pink">
          <AlertTriangle size={48} className="text-plasma-pink mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold text-white mb-2">
            Invalid Task ID
          </h2>
          <p className="text-gray-400 font-body mb-6">
            No task ID was provided in the URL.
          </p>
          <Link href="/marketplace">
            <NeonButton variant="secondary">
              <ArrowRight size={14} className="rotate-180" />
              Back to Marketplace
            </NeonButton>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen neural-bg py-8 px-4">
      <motion.div
        className="max-w-4xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
                <FileText size={40} className="text-biolum-cyan" />
                Task #{taskId}
              </h1>
              {status !== undefined && (
                <StatusBadge status={status} size="md" />
              )}
            </div>
            <Link href="/marketplace">
              <NeonButton variant="ghost" size="sm">
                <ArrowRight size={14} className="rotate-180" />
                Marketplace
              </NeonButton>
            </Link>
          </div>
        </motion.div>

        {taskLoading ? (
          <GlassCard className="p-8">
            <LoadingPulse lines={8} />
          </GlassCard>
        ) : !task ? (
          <GlassCard className="p-10 text-center" glowColor="pink">
            <AlertTriangle size={48} className="text-plasma-pink mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Task Not Found
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Task #{taskId} does not exist on-chain.
            </p>
            <Link href="/marketplace">
              <NeonButton variant="secondary">
                Browse Marketplace
                <ArrowRight size={14} />
              </NeonButton>
            </Link>
          </GlassCard>
        ) : (
          <>
            {/* Task Info */}
            <motion.div variants={itemVariants} className="mb-8">
              <GlassCard className="p-6" glowColor="cyan">
                <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
                  <Shield size={20} className="text-biolum-cyan" />
                  Task Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Client */}
                  <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={14} className="text-synapse-violet" />
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Client</span>
                    </div>
                    <p className="font-mono text-sm text-white">
                      {client ? formatAddress(client) : "---"}
                    </p>
                    {isClient && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-synapse-violet/10 border border-synapse-violet/30 text-synapse-violet">
                        You
                      </span>
                    )}
                  </div>

                  {/* Worker */}
                  <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={14} className="text-biolum-cyan" />
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Worker</span>
                    </div>
                    <p className="font-mono text-sm text-white">
                      {worker && worker !== "0x0000000000000000000000000000000000000000"
                        ? formatAddress(worker)
                        : "Unassigned"}
                    </p>
                    {isWorker && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-biolum-cyan/10 border border-biolum-cyan/30 text-biolum-cyan">
                        You
                      </span>
                    )}
                  </div>

                  {/* Payment */}
                  <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins size={14} className="text-neuron-gold" />
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Payment</span>
                    </div>
                    <p className="font-mono text-lg font-bold text-neuron-gold">
                      {payment !== undefined ? `${formatEth(payment)} ETH` : "---"}
                    </p>
                  </div>

                  {/* Deadline */}
                  <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={14} className="text-plasma-pink" />
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Deadline</span>
                    </div>
                    <p className="font-mono text-sm text-white">
                      {deadline
                        ? new Date(Number(deadline) * 1000).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "---"}
                    </p>
                    {deadline && Number(deadline) * 1000 < Date.now() && status !== TaskStatus.Completed && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-plasma-pink/10 border border-plasma-pink/30 text-plasma-pink">
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* Description Hash */}
                  <div className="p-4 bg-glass/30 rounded-xl border border-glass-border sm:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Hash size={14} className="text-gray-400" />
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Description Hash</span>
                    </div>
                    <p className="font-mono text-xs text-gray-400 break-all">
                      {descriptionHash || "---"}
                    </p>
                  </div>

                  {/* Deliverable Hash */}
                  {deliverableHash && deliverableHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                    <div className="p-4 bg-glass/30 rounded-xl border border-glass-border sm:col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-green-400" />
                        <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Deliverable Hash</span>
                      </div>
                      <p className="font-mono text-xs text-green-400 break-all">
                        {deliverableHash}
                      </p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Created</span>
                    </div>
                    <p className="font-mono text-sm text-white">
                      {createdAt
                        ? new Date(Number(createdAt) * 1000).toLocaleDateString()
                        : "---"}
                    </p>
                  </div>

                  <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={14} className="text-gray-400" />
                      <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">Completed</span>
                    </div>
                    <p className="font-mono text-sm text-white">
                      {completedAt && Number(completedAt) > 0
                        ? new Date(Number(completedAt) * 1000).toLocaleDateString()
                        : "In progress"}
                    </p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* Actions */}
            <motion.div variants={itemVariants}>
              <GlassCard className="p-6" glowColor="violet">
                <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
                  <Play size={20} className="text-synapse-violet" />
                  Actions
                </h3>

                <div className="space-y-4">
                  {/* Worker: Submit Work */}
                  {isWorker && status === TaskStatus.InProgress && (
                    <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                      <h4 className="font-display font-semibold text-white mb-2">Submit Deliverable</h4>
                      <p className="text-gray-400 font-body text-sm mb-3">
                        Submit your completed work. The deliverable hash will be stored on-chain for verification.
                      </p>
                      <NeonButton
                        variant="primary"
                        size="sm"
                        loading={isSubmitting}
                        onClick={() => {
                          const hash = prompt("Enter deliverable hash (IPFS CID or bytes32):");
                          if (hash && taskId !== undefined) {
                            submitWork(BigInt(taskId), hash);
                          }
                        }}
                      >
                        Submit Work
                      </NeonButton>
                    </div>
                  )}

                  {/* Client: Verify Task */}
                  {isClient && status === TaskStatus.Submitted && (
                    <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                      <h4 className="font-display font-semibold text-white mb-2">Verify Work</h4>
                      <p className="text-gray-400 font-body text-sm mb-3">
                        Review the submitted deliverable and approve or reject the work.
                      </p>
                      <div className="flex gap-3">
                        <NeonButton
                          variant="primary"
                          size="sm"
                          loading={isVerifying}
                          onClick={() => {
                            if (taskId !== undefined) {
                              verifyTask(BigInt(taskId), true);
                            }
                          }}
                        >
                          <CheckCircle2 size={16} />
                          Approve
                        </NeonButton>
                        <NeonButton
                          variant="danger"
                          size="sm"
                          loading={isVerifying}
                          onClick={() => {
                            if (taskId !== undefined) {
                              verifyTask(BigInt(taskId), false);
                            }
                          }}
                        >
                          <XCircle size={16} />
                          Reject
                        </NeonButton>
                      </div>
                    </div>
                  )}

                  {/* Any party: Dispute */}
                  {(isClient || isWorker) && status !== TaskStatus.Completed && status !== TaskStatus.Failed && status !== TaskStatus.Disputed && (
                    <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
                      <h4 className="font-display font-semibold text-white mb-2">Dispute Task</h4>
                      <p className="text-gray-400 font-body text-sm mb-3">
                        If there is a disagreement, initiate a dispute for DAO arbitration.
                      </p>
                      <NeonButton
                        variant="danger"
                        size="sm"
                        loading={isDisputing}
                        onClick={() => {
                          const reason = prompt("Reason for dispute:");
                          if (reason && taskId !== undefined) {
                            disputeTask(BigInt(taskId));
                          }
                        }}
                      >
                        <AlertTriangle size={16} />
                        Open Dispute
                      </NeonButton>
                    </div>
                  )}

                  {/* No actions available */}
                  {!isClient && !isWorker && (
                    <div className="text-center py-6">
                      <p className="text-gray-500 font-body text-sm">
                        You are not a party to this task. Only the client or worker can perform actions.
                      </p>
                    </div>
                  )}

                  {status === TaskStatus.Completed && (
                    <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center gap-3">
                      <CheckCircle2 size={24} className="text-green-400 flex-shrink-0" />
                      <div>
                        <p className="text-green-400 font-display font-semibold">Task Completed</p>
                        <p className="text-gray-400 font-body text-sm">Payment has been released to the worker.</p>
                      </div>
                    </div>
                  )}

                  {status === TaskStatus.Failed && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-center gap-3">
                      <XCircle size={24} className="text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-red-400 font-display font-semibold">Task Failed</p>
                        <p className="text-gray-400 font-body text-sm">Payment has been refunded to the client.</p>
                      </div>
                    </div>
                  )}

                  {status === TaskStatus.Disputed && (
                    <div className="p-4 bg-yellow-900/20 border border-yellow-500/30 rounded-xl flex items-center gap-3">
                      <AlertTriangle size={24} className="text-yellow-400 flex-shrink-0" />
                      <div>
                        <p className="text-yellow-400 font-display font-semibold">Task Disputed</p>
                        <p className="text-gray-400 font-body text-sm">
                          This task is under DAO arbitration. Check the disputes page for updates.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
