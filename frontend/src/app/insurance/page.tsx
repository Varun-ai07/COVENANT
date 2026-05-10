"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { EmptyState } from "@/components/visual";
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
      <Card className="p-5">
        <LoadingPulse lines={4} />
      </Card>
    );
  }

  if (!claim) return null;

  const voteDeadline = Number(claim.voteDeadline) * 1000;
  const isActive = voteDeadline > Date.now();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-heading font-semibold text-foreground">
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
          <span className="text-sm text-muted font-mono flex items-center gap-1.5">
            <Clock size={14} />
            {isActive
              ? `Voting ends ${new Date(voteDeadline).toLocaleString()}`
              : "Voting closed"}
          </span>
        </div>

        <div className="space-y-2 text-sm font-mono mb-4">
          <div className="flex justify-between">
            <span className="text-muted">Claimant:</span>
            <span className="text-foreground">{formatAddress(claim.claimant)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Task ID:</span>
            <span className="text-foreground">#{claim.taskId.toString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Amount:</span>
            <span className="text-warning">{formatEth(claim.amount)} ETH</span>
          </div>
        </div>

        {/* Vote tally */}
        <div className="flex items-center gap-6 mb-4 text-sm font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success" />
            <span className="text-success">For: {claim.forVotes.toString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-danger" />
            <span className="text-danger">Against: {claim.againstVotes.toString()}</span>
          </div>
          <span className="text-muted">({claim.votersCount.toString()} voters)</span>
        </div>

        {/* Vote buttons */}
        {!claim.paid && isActive && (
          <div className="flex gap-3">
            <Button
              variant="primary"
              size="sm"
              onClick={() => voteOnClaim(claim.claimId, true)}
              loading={isVoting}
              className="flex-1"
            >
              <CheckCircle2 size={14} />
              Vote For
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => voteOnClaim(claim.claimId, false)}
              loading={isVoting}
              className="flex-1"
            >
              <XCircle size={14} />
              Vote Against
            </Button>
          </div>
        )}
      </Card>
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

  /* ---- Not connected — rich preview ---- */
  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <Shield className="w-10 h-10 text-accent" />
              Agent Insurance
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Protect your agents against failed tasks. COVENANT&apos;s community-governed insurance pool lets members stake ETH, pay premiums per task, file claims, and vote on disputed payouts.
            </p>
          </div>

          {/* Pool overview explanation */}
          <Card className="p-6 mb-8">
            <div className="flex items-start gap-4 mb-6">
              <Shield className="w-8 h-8 text-accent flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-heading font-bold mb-1 text-foreground">Pool Overview</h2>
                <p className="text-muted text-sm font-body">
                  Community-governed insurance pool backed by member stakes and premiums.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-alt/50 border border-border rounded-xl p-4 text-center">
                <Coins className="w-5 h-5 text-warning mx-auto mb-2" />
                <p className="text-xs text-muted font-mono mb-1">Pool Balance</p>
                <p className="text-xl font-heading font-bold text-warning">---</p>
              </div>
              <div className="bg-surface-alt/50 border border-border rounded-xl p-4 text-center">
                <Users className="w-5 h-5 text-info mx-auto mb-2" />
                <p className="text-xs text-muted font-mono mb-1">Members</p>
                <p className="text-xl font-heading font-bold text-info">---</p>
              </div>
              <div className="bg-surface-alt/50 border border-border rounded-xl p-4 text-center">
                <FileText className="w-5 h-5 text-danger mx-auto mb-2" />
                <p className="text-xs text-muted font-mono mb-1">Claims</p>
                <p className="text-xl font-heading font-bold text-danger">---</p>
              </div>
            </div>
          </Card>

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-5 border-accent/30">
              <Plus size={20} className="text-accent mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Join & Stake</h3>
              <p className="text-muted font-mono text-xs">Deposit ETH into the pool to become a member. Your stake backs the collective risk.</p>
            </Card>
            <Card className="p-5 border-warning/30">
              <Coins size={20} className="text-warning mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Pay Premiums</h3>
              <p className="text-muted font-mono text-xs">For each task you want covered, pay a premium to the pool. This extends coverage to that specific task.</p>
            </Card>
            <Card className="p-5 border-danger/30">
              <Vote size={20} className="text-danger mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">File & Vote</h3>
              <p className="text-muted font-mono text-xs">If a task fails, file a claim. Pool members vote to approve or reject — approved claims are paid from the pool.</p>
            </Card>
          </div>

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
        <h1 className="text-4xl font-bold flex items-center gap-3 text-foreground">
          <Shield className="w-10 h-10 text-accent" />
          Agent Insurance
        </h1>
        <p className="text-muted mt-2 font-body">
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
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <Shield className="w-8 h-8 text-accent flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-heading font-bold mb-1 text-foreground">
                Pool Overview
              </h2>
              <p className="text-muted text-sm font-body">
                Community-governed insurance pool backed by member stakes and
                premiums.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-alt/50 border border-border rounded-xl p-4 text-center">
              <Coins className="w-5 h-5 text-warning mx-auto mb-2" />
              <p className="text-xs text-muted font-mono mb-1">Pool Balance</p>
              {isBalanceLoading ? (
                <LoadingPulse lines={1} />
              ) : (
                <p className="text-xl font-heading font-bold text-warning">
                  {formatEth(poolBalance)} ETH
                </p>
              )}
            </div>
            <div className="bg-surface-alt/50 border border-border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-info mx-auto mb-2" />
              <p className="text-xs text-muted font-mono mb-1">Members</p>
              {isMemberCountLoading ? (
                <LoadingPulse lines={1} />
              ) : (
                <p className="text-xl font-heading font-bold text-info">
                  {memberCount?.toString() ?? "0"}
                </p>
              )}
            </div>
            <div className="bg-surface-alt/50 border border-border rounded-xl p-4 text-center">
              <FileText className="w-5 h-5 text-danger mx-auto mb-2" />
              <p className="text-xs text-muted font-mono mb-1">Claims</p>
              {isClaimCountLoading ? (
                <LoadingPulse lines={1} />
              ) : (
                <p className="text-xl font-heading font-bold text-danger">
                  {claimCount?.toString() ?? "0"}
                </p>
              )}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* ---- Member Actions ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Card className="p-6">
          <h2 className="text-2xl font-heading font-bold mb-2 text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-info" />
            Member Actions
          </h2>

          {isMemberInfoLoading ? (
            <LoadingPulse lines={4} />
          ) : !isMember ? (
            /* ---- Not a member ---- */
            <div className="text-center py-6">
              <p className="text-muted font-body mb-4">
                You are not yet a member of the insurance pool. Join to get
                coverage and participate in claim voting.
              </p>
              <Button
                variant="primary"
                onClick={() => joinPool()}
                loading={isJoining}
              >
                <Plus size={16} />
                Join Insurance Pool
              </Button>
            </div>
          ) : (
            /* ---- Is a member ---- */
            <div className="space-y-6">
              {/* Member summary */}
              <div className="flex flex-wrap gap-4 text-sm font-mono">
                <span className="text-muted">
                  Stake:{" "}
                  <span className="text-warning">
                    {formatEth(memberInfo?.stake)} ETH
                  </span>
                </span>
                <span className="text-muted">
                  Premiums Paid:{" "}
                  <span className="text-info">
                    {formatEth(memberInfo?.premiumPaid)} ETH
                  </span>
                </span>
              </div>

              {/* Pay Premium */}
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Coins size={18} className="text-warning" />
                  Pay Premium
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    value={premiumTaskId}
                    onChange={(e) => setPremiumTaskId(e.target.value)}
                    placeholder="Task ID"
                    className="flex-1 px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-foreground font-mono text-sm focus:border-accent focus:outline-none transition-colors"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (premiumTaskId) payPremium(BigInt(premiumTaskId));
                    }}
                    loading={isPaying}
                    disabled={!premiumTaskId}
                  >
                    <Coins size={14} />
                    Pay Premium
                  </Button>
                </div>
              </div>

              {/* File Claim */}
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText size={18} className="text-danger" />
                  File Claim
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    value={claimTaskId}
                    onChange={(e) => setClaimTaskId(e.target.value)}
                    placeholder="Task ID"
                    className="flex-1 px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-foreground font-mono text-sm focus:border-danger focus:outline-none transition-colors"
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (claimTaskId) claimInsurance(BigInt(claimTaskId));
                    }}
                    loading={isClaiming}
                    disabled={!claimTaskId}
                  >
                    <ArrowRight size={14} />
                    File Claim
                  </Button>
                </div>
              </div>

              {/* Withdraw */}
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ArrowDownToLine size={18} className="text-success" />
                  Withdraw Stake
                </h3>
                <p className="text-muted text-sm font-body mb-3">
                  Withdraw your stake from the insurance pool. This will remove
                  your membership and coverage.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => withdraw()}
                  loading={isWithdrawing}
                >
                  <ArrowDownToLine size={14} />
                  Withdraw
                </Button>
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ---- Claims List ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-heading font-bold mb-6 flex items-center gap-2 text-foreground">
          <Vote className="w-6 h-6 text-accent" />
          Insurance Claims
        </h2>

        {isClaimCountLoading ? (
          <div className="flex justify-center py-12">
            <LoadingPulse lines={5} />
          </div>
        ) : claimIds.length === 0 ? (
          <EmptyState
            title="No Claims Yet"
            description="No claims have been filed yet. File one above if you need coverage!"
          />
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
