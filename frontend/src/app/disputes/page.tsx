"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
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
      <GlassCard className="p-6">
        <LoadingPulse lines={4} />
      </GlassCard>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard
        className="p-6"
        glowColor={d.resolved ? "gold" : "pink"}
      >
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Gavel size={20} className={d.resolved ? "text-neuron-gold" : "text-plasma-pink"} />
            <h3 className="text-lg font-display font-bold text-white">
              Dispute #{disputeId.toString()}
            </h3>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono border ${
              d.resolved
                ? "bg-neuron-gold/10 border-neuron-gold/40 text-neuron-gold"
                : "bg-plasma-pink/10 border-plasma-pink/40 text-plasma-pink"
            }`}
          >
            {d.resolved ? "Resolved" : "Pending"}
          </span>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm mb-5">
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-gray-400 font-mono">Challenger</span>
            <span className="text-white font-mono">{formatAddress(d.challenger)}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-gray-400 font-mono">Client</span>
            <span className="text-white font-mono">{formatAddress(d.client)}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-gray-400 font-mono">Task ID</span>
            <span className="text-biolum-cyan font-mono">#{d.taskId.toString()}</span>
          </div>
          <div className="flex justify-between sm:flex-col sm:gap-1">
            <span className="text-gray-400 font-mono">Deadline</span>
            <span className={`font-mono ${isExpired && !d.resolved ? "text-red-400" : "text-white"}`}>
              {deadlineDate.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Vote progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs font-mono mb-1.5">
            <span className="text-neon-green">For ({forVotes})</span>
            <span className="text-red-400">Against ({againstVotes})</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-glass overflow-hidden flex">
            <div
              className="h-full bg-neon-green transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="h-full bg-red-400 transition-all duration-500"
              style={{ width: `${100 - forPct}%` }}
            />
          </div>
          <p className="text-gray-500 font-mono text-xs mt-1 text-center">
            {totalVotes} total vote{totalVotes !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Vote buttons (only when not resolved) */}
        {!d.resolved && (
          <div className="flex gap-3">
            <NeonButton
              variant="primary"
              size="sm"
              loading={isVoting}
              onClick={() => castVote(d.disputeId, true)}
              className="flex-1"
            >
              <Vote size={14} />
              Vote For
            </NeonButton>
            <NeonButton
              variant="danger"
              size="sm"
              loading={isVoting}
              onClick={() => castVote(d.disputeId, false)}
              className="flex-1"
            >
              <Vote size={14} />
              Vote Against
            </NeonButton>
          </div>
        )}
      </GlassCard>
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

  /* ---- Wallet gate ---- */
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="p-8 text-center max-w-md w-full">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-neon-blue" />
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-gray-400">
            Please connect your wallet to access dispute arbitration.
          </p>
        </GlassCard>
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
        <h1 className="text-4xl md:text-5xl font-display font-bold flex items-center gap-3">
          <Scale className="w-10 h-10 text-synapse-violet" />
          <span className="text-white">Dispute </span>
          <span className="text-synapse-violet">Arbitration</span>
        </h1>
        <p className="text-gray-400 font-body mt-2">
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
        <GlassCard className="p-6" glowColor="violet">
          <div className="flex items-start gap-4">
            <Gavel className="w-8 h-8 text-synapse-violet flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-display font-semibold text-white mb-2">
                How Disputes Work
              </h2>
              <p className="text-gray-300 font-body mb-4">
                If a task deliverable is unsatisfactory or a client refuses payment, any party
                can file a dispute. Token holders then vote to determine the outcome — the
                losing side's escrowed funds are redistributed accordingly.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-400 font-mono">
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
        </GlassCard>
      </motion.div>

      {/* ---- File Dispute Form ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <GlassCard className="p-6" glowColor="pink">
          <h2 className="text-xl font-display font-semibold text-white mb-5 flex items-center gap-2">
            <Gavel size={20} className="text-plasma-pink" />
            File a Dispute
          </h2>
          <form onSubmit={handleFileDispute} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-mono text-gray-400 mb-1.5">
                Task ID
              </label>
              <input
                type="number"
                min="0"
                value={disputeTaskId}
                onChange={(e) => setDisputeTaskId(e.target.value)}
                placeholder="Enter the task ID to dispute"
                className="w-full px-4 py-2.5 bg-glass border border-glass-border rounded-xl text-white font-mono text-sm focus:border-plasma-pink focus:outline-none transition-colors"
                required
              />
            </div>
            <div className="flex items-end">
              <NeonButton
                type="submit"
                variant="secondary"
                loading={isFilingDispute}
                disabled={!disputeTaskId}
                className="w-full sm:w-auto"
              >
                <Gavel size={16} />
                File Dispute
              </NeonButton>
            </div>
          </form>
        </GlassCard>
      </motion.div>

      {/* ---- Disputes List ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
          <Vote className="w-6 h-6 text-neon-blue" />
          Active Disputes
          {!isLoadingCounter && (
            <span className="text-sm font-mono text-gray-400 ml-2">
              ({totalDisputes})
            </span>
          )}
        </h2>

        {isLoadingCounter ? (
          <LoadingPulse lines={6} />
        ) : totalDisputes === 0 ? (
          <GlassCard className="p-8 text-center">
            <Scale className="w-10 h-10 mx-auto mb-3 text-gray-600" />
            <p className="text-gray-400 font-body">
              No disputes have been filed. The network is at peace.
            </p>
          </GlassCard>
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
