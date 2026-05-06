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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useTask, useSubmitWork, useVerifyTask, useDisputeTask } from "@/hooks/useTask";
import { formatAddress, formatEth, TaskStatus, TASK_STATUS_LABELS } from "@/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
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
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <FileText className="w-10 h-10 text-info" />
              Task Details
            </h1>
            <p className="text-muted font-body max-w-2xl">
              View detailed task information including client, worker, payment, deadline, and verification status. Submit work, verify deliverables, or open disputes.
            </p>
          </div>

          {/* Task lifecycle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-5 border-accent/30">
              <Coins size={20} className="text-accent mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Escrow</h3>
              <p className="text-muted font-mono text-xs">Payment is locked in the TaskEscrow contract when a task is created.</p>
            </Card>
            <Card className="p-5 border-info/30">
              <User size={20} className="text-info mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Execute</h3>
              <p className="text-muted font-mono text-xs">Worker submits deliverables (IPFS hashes, URLs, or data) before the deadline.</p>
            </Card>
            <Card className="p-5 border-warning/30">
              <Shield size={20} className="text-warning mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Verify</h3>
              <p className="text-muted font-mono text-xs">Automated verification pipeline or manual client approval determines outcome.</p>
            </Card>
            <Card className="p-5 border-danger/30">
              <CheckCircle2 size={20} className="text-danger mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Settle</h3>
              <p className="text-muted font-mono text-xs">Payment releases to worker on success or refunds to client on failure.</p>
            </Card>
          </div>

          {/* Subtle CTA */}
          <div className="mt-12 text-center p-8 rounded-xl bg-surface border border-border">
            <h3 className="font-heading text-xl text-foreground mb-2">Connect for Full Access</h3>
            <p className="text-muted font-body text-sm mb-4">Connect your wallet to view task details and perform actions.</p>
            <Link href="/marketplace">
              <Button variant="secondary">Browse Marketplace</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (taskId === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="p-10 max-w-md text-center">
          <AlertTriangle size={48} className="text-danger mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
            Invalid Task ID
          </h2>
          <p className="text-muted font-body mb-6">
            No task ID was provided in the URL.
          </p>
          <Link href="/marketplace">
            <Button variant="secondary">
              <ArrowRight size={14} className="rotate-180" />
              Back to Marketplace
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
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
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
                <FileText size={40} className="text-info" />
                Task #{taskId}
              </h1>
              {status !== undefined && (
                <StatusBadge status={status} size="md" />
              )}
            </div>
            <Link href="/marketplace">
              <Button variant="ghost" size="sm">
                <ArrowRight size={14} className="rotate-180" />
                Marketplace
              </Button>
            </Link>
          </div>
        </motion.div>

        {taskLoading ? (
          <Card className="p-8">
            <LoadingPulse lines={8} />
          </Card>
        ) : !task ? (
          <Card className="p-10 text-center">
            <AlertTriangle size={48} className="text-danger mx-auto mb-4" />
            <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
              Task Not Found
            </h2>
            <p className="text-muted font-body mb-6">
              Task #{taskId} does not exist on-chain.
            </p>
            <Link href="/marketplace">
              <Button variant="secondary">
                Browse Marketplace
                <ArrowRight size={14} />
              </Button>
            </Link>
          </Card>
        ) : (
          <>
            {/* Task Info */}
            <motion.div variants={itemVariants} className="mb-8">
              <Card className="p-6">
                <h3 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
                  <Shield size={20} className="text-info" />
                  Task Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Client */}
                  <div className="p-4 bg-surface/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={14} className="text-accent" />
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">Client</span>
                    </div>
                    <p className="font-mono text-sm text-foreground">
                      {client ? formatAddress(client) : "---"}
                    </p>
                    {isClient && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-accent/10 border border-accent/30 text-accent">
                        You
                      </span>
                    )}
                  </div>

                  {/* Worker */}
                  <div className="p-4 bg-surface/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <User size={14} className="text-info" />
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">Worker</span>
                    </div>
                    <p className="font-mono text-sm text-foreground">
                      {worker && worker !== "0x0000000000000000000000000000000000000000"
                        ? formatAddress(worker)
                        : "Unassigned"}
                    </p>
                    {isWorker && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-info/10 border border-info/30 text-info">
                        You
                      </span>
                    )}
                  </div>

                  {/* Payment */}
                  <div className="p-4 bg-surface/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Coins size={14} className="text-warning" />
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">Payment</span>
                    </div>
                    <p className="font-mono text-lg font-bold text-warning">
                      {payment !== undefined ? `${formatEth(payment)} ETH` : "---"}
                    </p>
                  </div>

                  {/* Deadline */}
                  <div className="p-4 bg-surface/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar size={14} className="text-danger" />
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">Deadline</span>
                    </div>
                    <p className="font-mono text-sm text-foreground">
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
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-danger/10 border border-danger/30 text-danger">
                        Overdue
                      </span>
                    )}
                  </div>

                  {/* Description Hash */}
                  <div className="p-4 bg-surface/30 rounded-xl border border-border sm:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Hash size={14} className="text-muted" />
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">Description Hash</span>
                    </div>
                    <p className="font-mono text-xs text-muted break-all">
                      {descriptionHash || "---"}
                    </p>
                  </div>

                  {/* Deliverable Hash */}
                  {deliverableHash && deliverableHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                    <div className="p-4 bg-surface/30 rounded-xl border border-border sm:col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 size={14} className="text-success" />
                        <span className="text-xs font-mono text-muted uppercase tracking-wider">Deliverable Hash</span>
                      </div>
                      <p className="font-mono text-xs text-success break-all">
                        {deliverableHash}
                      </p>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="p-4 bg-surface/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-muted" />
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">Created</span>
                    </div>
                    <p className="font-mono text-sm text-foreground">
                      {createdAt
                        ? new Date(Number(createdAt) * 1000).toLocaleDateString()
                        : "---"}
                    </p>
                  </div>

                  <div className="p-4 bg-surface/30 rounded-xl border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 size={14} className="text-muted" />
                      <span className="text-xs font-mono text-muted uppercase tracking-wider">Completed</span>
                    </div>
                    <p className="font-mono text-sm text-foreground">
                      {completedAt && Number(completedAt) > 0
                        ? new Date(Number(completedAt) * 1000).toLocaleDateString()
                        : "In progress"}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Actions */}
            <motion.div variants={itemVariants}>
              <Card className="p-6">
                <h3 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
                  <Play size={20} className="text-accent" />
                  Actions
                </h3>

                <div className="space-y-4">
                  {/* Worker: Submit Work */}
                  {isWorker && status === TaskStatus.InProgress && (
                    <div className="p-4 bg-surface/30 rounded-xl border border-border">
                      <h4 className="font-heading font-semibold text-foreground mb-2">Submit Deliverable</h4>
                      <p className="text-muted font-body text-sm mb-3">
                        Submit your completed work. The deliverable hash will be stored on-chain for verification.
                      </p>
                      <Button
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
                      </Button>
                    </div>
                  )}

                  {/* Client: Verify Task */}
                  {isClient && status === TaskStatus.Submitted && (
                    <div className="p-4 bg-surface/30 rounded-xl border border-border">
                      <h4 className="font-heading font-semibold text-foreground mb-2">Verify Work</h4>
                      <p className="text-muted font-body text-sm mb-3">
                        Review the submitted deliverable and approve or reject the work.
                      </p>
                      <div className="flex gap-3">
                        <Button
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
                        </Button>
                        <Button
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
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Any party: Dispute */}
                  {(isClient || isWorker) && status !== TaskStatus.Completed && status !== TaskStatus.Failed && status !== TaskStatus.Disputed && (
                    <div className="p-4 bg-surface/30 rounded-xl border border-border">
                      <h4 className="font-heading font-semibold text-foreground mb-2">Dispute Task</h4>
                      <p className="text-muted font-body text-sm mb-3">
                        If there is a disagreement, initiate a dispute for DAO arbitration.
                      </p>
                      <Button
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
                      </Button>
                    </div>
                  )}

                  {/* No actions available */}
                  {!isClient && !isWorker && (
                    <div className="text-center py-6">
                      <p className="text-muted font-body text-sm">
                        You are not a party to this task. Only the client or worker can perform actions.
                      </p>
                    </div>
                  )}

                  {status === TaskStatus.Completed && (
                    <div className="p-4 bg-success/10 border border-success/30 rounded-xl flex items-center gap-3">
                      <CheckCircle2 size={24} className="text-success flex-shrink-0" />
                      <div>
                        <p className="text-success font-heading font-semibold">Task Completed</p>
                        <p className="text-muted font-body text-sm">Payment has been released to the worker.</p>
                      </div>
                    </div>
                  )}

                  {status === TaskStatus.Failed && (
                    <div className="p-4 bg-danger/10 border border-danger/30 rounded-xl flex items-center gap-3">
                      <XCircle size={24} className="text-danger flex-shrink-0" />
                      <div>
                        <p className="text-danger font-heading font-semibold">Task Failed</p>
                        <p className="text-muted font-body text-sm">Payment has been refunded to the client.</p>
                      </div>
                    </div>
                  )}

                  {status === TaskStatus.Disputed && (
                    <div className="p-4 bg-warning/10 border border-warning/30 rounded-xl flex items-center gap-3">
                      <AlertTriangle size={24} className="text-warning flex-shrink-0" />
                      <div>
                        <p className="text-yellow-400 font-heading font-semibold">Task Disputed</p>
                        <p className="text-muted font-body text-sm">
                          This task is under DAO arbitration. Check the disputes page for updates.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
