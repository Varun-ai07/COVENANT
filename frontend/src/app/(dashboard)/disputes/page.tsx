"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { EmptyState } from "@/components/visual";
import Link from "next/link";
import { Scale, Gavel, Vote, ArrowRight, LogIn } from "lucide-react";
import {
  useDisputeCounter,
  useDispute,
  useDisputeTask,
  useCastDisputeVote,
} from "@/hooks/useDisputeArbitration";
import { formatAddress } from "@/types";
import type { DisputeData } from "@/hooks/useDisputeArbitration";

/* ------------------------------------------------------------------ */
/*  Dispute Card                                                       */
/* ------------------------------------------------------------------ */

interface DisputeCardProps {
  disputeId: bigint;
}

function DisputeCard({ disputeId }: DisputeCardProps) {
  const { data: dispute, isLoading } = useDispute(Number(disputeId));
  const { castVote, isPending: isVoting } = useCastDisputeVote();

  if (isLoading) {
    return (
      <Card className="p-6">
        <LoadingPulse lines={4} />
      </Card>
    );
  }

  if (!dispute) return null;

  const d = dispute as DisputeData;
  const forVotes = Number(d.forVotes);
  const againstVotes = Number(d.againstVotes);
  const totalVotes = forVotes + againstVotes;
  const forPct = totalVotes > 0 ? (forVotes / totalVotes) * 100 : 50;
  const deadlineDate = new Date(Number(d.deadline) * 1000);
  const isExpired = deadlineDate.getTime() < Date.now();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-6">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Gavel size={20} className={d.resolved ? "text-warning" : "text-danger"} />
            <h3 className="text-lg font-heading font-bold text-foreground">
              Dispute #{disputeId.toString()}
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono border ${
              d.resolved
                ? "bg-warning/10 border-warning/40 text-warning"
                : "bg-danger/10 border-danger/40 text-danger"
            }`}
          >
            {d.resolved ? "Resolved" : "Pending"}
          </span>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-muted font-mono">Challenger</span>
            <span className="text-foreground font-mono">{formatAddress(d.challenger)}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-muted font-mono">Client</span>
            <span className="text-foreground font-mono">{formatAddress(d.client)}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-muted font-mono">Task ID</span>
            <span className="text-info font-mono">#{d.taskId.toString()}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-muted font-mono">Deadline</span>
            <span className={`font-mono ${isExpired && !d.resolved ? "text-danger" : "text-foreground"}`}>
              {deadlineDate.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Vote progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-success">For ({forVotes})</span>
            <span className="text-danger">Against ({againstVotes})</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-surface-alt overflow-hidden flex">
            <div
              className="h-full bg-success transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="h-full bg-danger transition-all duration-500"
              style={{ width: `${100 - forPct}%` }}
            />
          </div>
          <p className="text-muted font-mono text-xs mt-1 text-center">
            {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Vote buttons (only when not resolved) */}
        {!d.resolved && (
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="sm"
              loading={isVoting}
              onClick={() => castVote(d.disputeId, true)}
              className="flex-1"
            >
              <Vote size={14} />
              Vote For
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={isVoting}
              onClick={() => castVote(d.disputeId, false)}
              className="flex-1"
            >
              <Vote size={14} />
              Vote Against
            </Button>
          </div>
        )}
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DisputesPage() {
  const { address, isConnected } = useAccount();
  const [disputeTaskId, setDisputeTaskId] = useState("");

  const { count: disputeCounter, isLoading: isLoadingCounter } = useDisputeCounter();
  const { disputeTask, isPending: isFilingDispute } = useDisputeTask();

  const totalDisputes = disputeCounter ? Number(disputeCounter) : 0;

  const handleFileDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeTaskId || !address) return;
    disputeTask(BigInt(disputeTaskId));
    setDisputeTaskId("");
  };

  /* ---- Not connected — rich preview ---- */
  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <Scale className="w-10 h-10 text-accent" />
              Dispute Arbitration
            </h1>
            <p className="text-muted font-body max-w-2xl">
              File disputes against unsatisfactory task deliverables or refused payments, and let the community vote on resolution. The losing side&apos;s escrowed funds are redistributed accordingly.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-5 border-accent/30">
              <Scale size={20} className="text-accent mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">File a Dispute</h3>
              <p className="text-muted font-mono text-xs">Submit a dispute against any task ID. Both clients and workers can initiate disputes for DAO arbitration.</p>
            </Card>
            <Card className="p-5 border-info/30">
              <Vote size={20} className="text-info mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Community Votes</h3>
              <p className="text-muted font-mono text-xs">Token holders vote For or Against the dispute. A transparent voting bar shows real-time tallies.</p>
            </Card>
            <Card className="p-5 border-warning/30">
              <Gavel size={20} className="text-warning mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Resolution</h3>
              <p className="text-muted font-mono text-xs">When voting concludes, escrowed funds are redistributed to the winning party automatically on-chain.</p>
            </Card>
          </div>

          {/* Stats preview */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card className="p-4">
              <Gavel size={20} className="text-danger mb-2" />
              <p className="text-2xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs">Total Disputes</p>
            </Card>
            <Card className="p-4">
              <Vote size={20} className="text-info mb-2" />
              <p className="text-2xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs">Votes Cast</p>
            </Card>
          </div>

          {/* Subtle CTA */}
          <div className="mt-12 text-center p-8 rounded-xl bg-surface border border-border">
            <h3 className="font-heading text-xl text-foreground mb-2">Connect for Full Access</h3>
            <p className="text-muted font-body text-sm mb-4">Connect your wallet to file disputes and participate in voting.</p>
            <Link href="/">
              <Button variant="secondary">Go to Home to Connect</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* ---- Header ---- */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl md:text-5xl font-heading font-bold flex items-center gap-3">
          <Scale className="w-10 h-10 text-accent" />
          <span className="text-foreground">Dispute </span>
          <span className="text-accent">Arbitration</span>
        </h1>
        <p className="text-muted font-body mt-2">
          File disputes against tasks and let the community vote on resolution.
        </p>
      </motion.div>

      {/* ---- Info Card ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Gavel className="w-8 h-8 text-accent flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-heading font-semibold text-foreground mb-2">
                How Disputes Work
              </h2>
              <p className="text-muted font-body mb-4">
                If a task deliverable is unsatisfactory or a client refuses payment, any party
                can file a dispute. Token holders then vote to determine the outcome — the
                losing side's escrowed funds are redistributed accordingly.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-muted font-mono">
                <div className="flex items-center gap-2">
                  <Scale size={14} />
                  <span>File a dispute with a task ID</span>
                </div>
                <div className="flex items-center gap-2">
                  <Vote size={14} />
                  <span>Community votes For / Against</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight size={14} />
                  <span>Resolution settles escrow</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ---- File Dispute Form ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Card className="p-6">
          <h2 className="text-xl font-heading font-semibold text-foreground mb-5 flex items-center gap-2">
            <Gavel size={20} className="text-danger" />
            File a Dispute
          </h2>
          <form onSubmit={handleFileDispute} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-mono text-muted mb-1.5">
                Task ID
              </label>
              <input
                type="number"
                min="0"
                value={disputeTaskId}
                onChange={(e) => setDisputeTaskId(e.target.value)}
                placeholder="Enter the task ID to dispute"
                className="w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-foreground font-mono text-sm focus:border-danger focus:outline-none transition-colors"
                required
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                variant="secondary"
                loading={isFilingDispute}
                disabled={!disputeTaskId}
                className="w-full sm:w-auto"
              >
                <Gavel size={16} />
                File Dispute
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>

      {/* ---- Disputes List ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2">
          <Vote className="w-6 h-6 text-info" />
          Active Disputes
          {!isLoadingCounter && (
            <span className="text-sm font-mono text-muted ml-2">
              ({totalDisputes})
            </span>
          )}
        </h2>

        {isLoadingCounter ? (
          <LoadingPulse lines={6} />
        ) : totalDisputes === 0 ? (
          <EmptyState
            title="No Disputes"
            description="No disputes have been filed. The network is at peace."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: totalDisputes }, (_, i) => i)
              .reverse()
              .map((i) => (
                <DisputeCard key={i} disputeId={BigInt(i)} />
              ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
