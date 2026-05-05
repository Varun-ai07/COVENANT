"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  useInsurancePoolBalance,
  useInsuranceMemberInfo,
  useInsuranceClaimCount,
  useInsuranceClaim,
  useInsuranceMemberCount,
  useJoinInsurancePool,
  usePayPremium,
  useClaimInsurance,
  useVoteOnClaim,
  useWithdrawInsurance,
} from "@/hooks/useAgentInsurance";
import { formatEth, formatAddress } from "@/types";
import {
  Shield,
  Plus,
  Coins,
  Users,
  Vote,
  ArrowRight,
  LogIn,
  FileText,
  ArrowDownToLine,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Claim Card                                                        */
/* ------------------------------------------------------------------ */

function ClaimCard({ claimId }: { claimId: number }) {
  const { data: claim, isLoading } = useInsuranceClaim(claimId);
  const { voteOnClaim, isPending: isVoting } = useVoteOnClaim();

  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <LoadingPulse lines={4} />
      </GlassCard>
    );
  }

  if (!claim) return null;

  const voteDeadline = Number(claim.voteDeadline) * 1000;
  const isActive = voteDeadline > Date.now();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <GlassCard className="p-5" glowColor={claim.paid ? "gold" : claim.approved ? "cyan" : "violet"}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-display font-semibold text-white">
              Claim #{claim.claimId.toString()}
            </h4>
            {claim.paid ? (
              <StatusBadge status="completed" size="sm" />
            ) : claim.approved ? (
              <StatusBadge status="in_progress" size="sm" />
            ) : isActive ? (
              <StatusBadge status="open" size="sm" />
            ) : (
              <StatusBadge status="failed" size="sm" />
            )}
          </div>
          <span className="text-sm text-gray-500 font-mono flex items-center gap-1.5">
            <Clock size={14} />
            {isActive
              ? `Voting ends ${new Date(voteDeadline).toLocaleString()}`
              : "Voting closed"}
          </span>
        </div>

        <div className="space-y-2 text-sm font-mono mb-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Claimant:</span>
            <span className="text-white">{formatAddress(claim.claimant)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Task ID:</span>
            <span className="text-white">#{claim.taskId.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount:</span>
            <span className="text-neuron-gold">{formatEth(claim.amount)} ETH</span>
          </div>
        </div>

        {/* Vote tally */}
        <div className="flex items-center gap-6 mb-4 text-sm font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-green-400">For: {claim.forVotes.toString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-red-400" />
            <span className="text-red-400">Against: {claim.againstVotes.toString()}</span>
          </div>
          <span className="text-gray-500">({claim.votersCount.toString()} voters)</span>
        </div>

        {/* Vote buttons */}
        {!claim.paid && isActive && (
          <div className="flex gap-3">
            <NeonButton
              variant="primary"
              size="sm"
              onClick={() => voteOnClaim(claim.claimId, true)}
              loading={isVoting}
              className="flex-1"
            >
              <CheckCircle2 size={14} />
              Vote For
            </NeonButton>
            <NeonButton
              variant="danger"
              size="sm"
              onClick={() => voteOnClaim(claim.claimId, false)}
              loading={isVoting}
              className="flex-1"
            >
              <XCircle size={14} />
              Vote Against
            </NeonButton>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function InsurancePage() {
  const { address, isConnected } = useAccount();

  /* Pool-wide reads */
  const { balance: poolBalance, isLoading: isBalanceLoading } = useInsurancePoolBalance();
  const { count: memberCount, isLoading: isMemberCountLoading } = useInsuranceMemberCount();
  const { count: claimCount, isLoading: isClaimCountLoading } = useInsuranceClaimCount();

  /* Member-specific reads */
  const { data: memberInfo, isLoading: isMemberInfoLoading } =
    useInsuranceMemberInfo(address);

  /* Write hooks */
  const { joinPool, isPending: isJoining } = useJoinInsurancePool();
  const { payPremium, isPending: isPaying } = usePayPremium();
  const { claimInsurance, isPending: isClaiming } = useClaimInsurance();
  const { withdraw, isPending: isWithdrawing } = useWithdrawInsurance();

  /* Local state */
  const [premiumTaskId, setPremiumTaskId] = useState("");
  const [claimTaskId, setClaimTaskId] = useState("");

  /* ---- Not connected ---- */
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="p-8 text-center max-w-md w-full">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-synapse-violet" />
          <h2 className="text-2xl font-display font-bold mb-2 text-white">
            Connect Wallet
          </h2>
          <p className="text-gray-400 font-body">
            Please connect your wallet to view and manage Agent Insurance.
          </p>
        </GlassCard>
      </div>
    );
  }

  const isMember = memberInfo?.isMember ?? false;

  /* Claim list: iterate 0 .. claimCount-1 */
  const claimIds = claimCount
    ? Array.from({ length: Number(claimCount) }, (_, i) => i)
    : [];

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* ---- Header ---- */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold flex items-center gap-3 text-white">
          <Shield className="w-10 h-10 text-synapse-violet" />
          Agent Insurance
        </h1>
        <p className="text-gray-400 mt-2 font-body">
          Protect your agents against failed tasks. Join the pool, pay premiums,
          file claims, and vote on disputed payouts.
        </p>
      </motion.div>

      {/* ---- Pool Info ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <GlassCard className="p-6" glowColor="violet">
          <div className="flex items-start gap-4 mb-6">
            <Shield className="w-8 h-8 text-synapse-violet flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-display font-bold mb-1 text-white">
                Pool Overview
              </h2>
              <p className="text-gray-400 text-sm font-body">
                Community-governed insurance pool backed by member stakes and
                premiums.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-glass/50 border border-glass-border rounded-xl p-4 text-center">
              <Coins className="w-5 h-5 text-neuron-gold mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-mono mb-1">Pool Balance</p>
              {isBalanceLoading ? (
                <LoadingPulse lines={1} />
              ) : (
                <p className="text-xl font-display font-bold text-neuron-gold">
                  {formatEth(poolBalance)} ETH
                </p>
              )}
            </div>
            <div className="bg-glass/50 border border-glass-border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-biolum-cyan mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-mono mb-1">Members</p>
              {isMemberCountLoading ? (
                <LoadingPulse lines={1} />
              ) : (
                <p className="text-xl font-display font-bold text-biolum-cyan">
                  {memberCount?.toString() ?? "0"}
                </p>
              )}
            </div>
            <div className="bg-glass/50 border border-glass-border rounded-xl p-4 text-center">
              <FileText className="w-5 h-5 text-plasma-pink mx-auto mb-2" />
              <p className="text-xs text-gray-400 font-mono mb-1">Claims</p>
              {isClaimCountLoading ? (
                <LoadingPulse lines={1} />
              ) : (
                <p className="text-xl font-display font-bold text-plasma-pink">
                  {claimCount?.toString() ?? "0"}
                </p>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ---- Member Actions ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <GlassCard className="p-6" glowColor="cyan">
          <h2 className="text-2xl font-display font-bold mb-2 text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-biolum-cyan" />
            Member Actions
          </h2>

          {isMemberInfoLoading ? (
            <LoadingPulse lines={4} />
          ) : !isMember ? (
            /* ---- Not a member ---- */
            <div className="text-center py-6">
              <p className="text-gray-400 font-body mb-4">
                You are not yet a member of the insurance pool. Join to get
                coverage and participate in claim voting.
              </p>
              <NeonButton
                variant="primary"
                onClick={() => joinPool()}
                loading={isJoining}
              >
                <Plus size={16} />
                Join Insurance Pool
              </NeonButton>
            </div>
          ) : (
            /* ---- Is a member ---- */
            <div className="space-y-6">
              {/* Member summary */}
              <div className="flex flex-wrap gap-4 text-sm font-mono">
                <span className="text-gray-400">
                  Stake:{" "}
                  <span className="text-neuron-gold">
                    {formatEth(memberInfo?.stake)} ETH
                  </span>
                </span>
                <span className="text-gray-400">
                  Premiums Paid:{" "}
                  <span className="text-biolum-cyan">
                    {formatEth(memberInfo?.premiumPaid)} ETH
                  </span>
                </span>
              </div>

              {/* Pay Premium */}
              <div>
                <h3 className="text-lg font-display font-semibold text-white mb-3 flex items-center gap-2">
                  <Coins size={18} className="text-neuron-gold" />
                  Pay Premium
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    value={premiumTaskId}
                    onChange={(e) => setPremiumTaskId(e.target.value)}
                    placeholder="Task ID"
                    className="flex-1 px-4 py-2.5 bg-glass border border-glass-border rounded-xl text-white font-mono text-sm focus:border-synapse-violet focus:outline-none transition-colors"
                  />
                  <NeonButton
                    variant="secondary"
                    onClick={() => {
                      if (premiumTaskId) payPremium(BigInt(premiumTaskId));
                    }}
                    loading={isPaying}
                    disabled={!premiumTaskId}
                  >
                    <Coins size={14} />
                    Pay Premium
                  </NeonButton>
                </div>
              </div>

              {/* File Claim */}
              <div>
                <h3 className="text-lg font-display font-semibold text-white mb-3 flex items-center gap-2">
                  <FileText size={18} className="text-plasma-pink" />
                  File Claim
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    value={claimTaskId}
                    onChange={(e) => setClaimTaskId(e.target.value)}
                    placeholder="Task ID"
                    className="flex-1 px-4 py-2.5 bg-glass border border-glass-border rounded-xl text-white font-mono text-sm focus:border-plasma-pink focus:outline-none transition-colors"
                  />
                  <NeonButton
                    variant="secondary"
                    onClick={() => {
                      if (claimTaskId) claimInsurance(BigInt(claimTaskId));
                    }}
                    loading={isClaiming}
                    disabled={!claimTaskId}
                  >
                    <ArrowRight size={14} />
                    File Claim
                  </NeonButton>
                </div>
              </div>

              {/* Withdraw */}
              <div>
                <h3 className="text-lg font-display font-semibold text-white mb-3 flex items-center gap-2">
                  <ArrowDownToLine size={18} className="text-green-400" />
                  Withdraw Stake
                </h3>
                <p className="text-gray-400 text-sm font-body mb-3">
                  Withdraw your stake from the insurance pool. This will remove
                  your membership and coverage.
                </p>
                <NeonButton
                  variant="ghost"
                  onClick={() => withdraw()}
                  loading={isWithdrawing}
                >
                  <ArrowDownToLine size={14} />
                  Withdraw
                </NeonButton>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ---- Claims List ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2 text-white">
          <Vote className="w-6 h-6 text-synapse-violet" />
          Insurance Claims
        </h2>

        {isClaimCountLoading ? (
          <div className="flex justify-center py-12">
            <LoadingPulse lines={5} />
          </div>
        ) : claimIds.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-gray-400 font-body">
              No claims have been filed yet. File one above if you need coverage!
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {claimIds.map((id) => (
              <ClaimCard key={id} claimId={id} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
