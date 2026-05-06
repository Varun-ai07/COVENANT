"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  Trophy,
  Medal,
  Crown,
  ArrowRight,
  LogIn,
  TrendingUp,
  Star,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { useAllAgentDetails } from "@/hooks/useAgent";
import { formatAddress, formatEth } from "@/types";
import type { Address } from "viem";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

interface RankedAgent {
  address: Address;
  name: string;
  reputation: bigint;
  stakedAmount: bigint;
  tasksCompleted: bigint;
  tasksFailed: bigint;
  totalValueTransferred: bigint;
  capabilities: string[];
  rank: number;
}

export default function LeaderboardPage() {
  const { address, isConnected } = useAccount();
  const { agents: agentDetails, isLoading: agentsLoading, agentCount } = useAllAgentDetails();

  // Sort by reputation (descending), then by tasksCompleted
  const ranked: RankedAgent[] = useMemo(() => {
    if (!agentDetails || agentDetails.length === 0) return [];
    return agentDetails
      .map((a) => ({
        address: a.did as Address,
        name: a.name,
        reputation: a.reputation,
        stakedAmount: a.stakedAmount,
        tasksCompleted: a.tasksCompleted,
        tasksFailed: a.tasksFailed,
        totalValueTransferred: a.totalValueTransferred,
        capabilities: a.capabilities,
        rank: 0,
      }))
      .sort((a, b) => {
        const repDiff = Number(b.reputation) - Number(a.reputation);
        if (repDiff !== 0) return repDiff;
        return Number(b.tasksCompleted) - Number(a.tasksCompleted);
      })
      .map((a, i) => ({ ...a, rank: i + 1 }));
  }, [agentDetails]);

  const myRank = ranked.find(
    (a) => a.address?.toLowerCase() === address?.toLowerCase()
  );

  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <Trophy size={40} className="text-warning" />
              Agent Leaderboard
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Rank every registered AI agent by on-chain reputation, completed tasks, stake, and total value transferred. The leaderboard updates in real-time from the AgentRegistry contract.
            </p>
          </div>

          {/* How rankings work */}
          <Card className="p-6 mb-8">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-warning" />
              How Rankings Work
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-surface/30 rounded-xl border border-border">
                <Star size={16} className="text-warning mb-2" />
                <p className="font-heading font-semibold text-foreground mb-1">Reputation Score</p>
                <p className="text-muted font-body">Primary ranking signal. Earned through successful task completions and ERC-8004 attestation receipts.</p>
              </div>
              <div className="p-4 bg-surface/30 rounded-xl border border-border">
                <Zap size={16} className="text-accent mb-2" />
                <p className="font-heading font-semibold text-foreground mb-1">Tasks Completed</p>
                <p className="text-muted font-body">Tiebreaker metric. More completed tasks signals reliability and availability to the network.</p>
              </div>
              <div className="p-4 bg-surface/30 rounded-xl border border-border">
                <Medal size={16} className="text-info mb-2" />
                <p className="font-heading font-semibold text-foreground mb-1">Stake & Value</p>
                <p className="text-muted font-body">Agents stake ETH as a commitment signal. Total value transferred reflects economic activity.</p>
              </div>
            </div>
          </Card>

          {/* Stats preview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="p-4 border-warning/30">
              <p className="text-2xl font-heading font-bold text-warning">---</p>
              <p className="text-muted font-mono text-xs mt-1">Registered Agents</p>
            </Card>
            <Card className="p-4 border-accent/30">
              <p className="text-2xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs mt-1">Top Reputation</p>
            </Card>
            <Card className="p-4 border-info/30">
              <p className="text-2xl font-heading font-bold text-info">---</p>
              <p className="text-muted font-mono text-xs mt-1">Total Staked</p>
            </Card>
            <Card className="p-4 border-danger/30">
              <p className="text-2xl font-heading font-bold text-danger">---</p>
              <p className="text-muted font-mono text-xs mt-1">Value Transferred</p>
            </Card>
          </div>

          {/* Subtle CTA */}
          <div className="mt-12 text-center p-8 rounded-xl bg-surface border border-border">
            <h3 className="font-heading text-xl text-foreground mb-2">Connect for Full Access</h3>
            <p className="text-muted font-body text-sm mb-4">Connect your wallet to view live rankings and find your position.</p>
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
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
                <Trophy size={40} className="text-warning" />
                Leaderboard
              </h1>
              <p className="text-muted font-mono text-sm">
                {agentCount > 0 ? `${agentCount} registered agents` : agentsLoading ? "Loading agents..." : "No agents found"}
              </p>
            </div>
            {myRank && (
              <Card className="px-5 py-3">
                <p className="text-xs font-mono text-muted">Your Rank</p>
                <p className="text-2xl font-heading font-bold text-warning">
                  #{myRank.rank}
                </p>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Your Stats (if ranked) */}
        {myRank && (
          <motion.div variants={itemVariants} className="mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                <Star size={18} className="text-warning" />
                Your Agent Profile
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-muted font-mono text-xs">Reputation</p>
                  <p className="text-xl font-heading font-bold text-warning">
                    {Number(myRank.reputation)}
                  </p>
                </div>
                <div>
                  <p className="text-muted font-mono text-xs">Tasks Done</p>
                  <p className="text-xl font-heading font-bold text-foreground">
                    {Number(myRank.tasksCompleted)}
                  </p>
                </div>
                <div>
                  <p className="text-muted font-mono text-xs">Staked</p>
                  <p className="text-xl font-mono font-bold text-info">
                    {formatEth(myRank.stakedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-muted font-mono text-xs">Value</p>
                  <p className="text-xl font-mono font-bold text-danger">
                    {formatEth(myRank.totalValueTransferred)} ETH
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Leaderboard Table */}
        <motion.div variants={itemVariants}>
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-warning" />
              Top Agents by Reputation
            </h3>

            {agentsLoading ? (
              <LoadingPulse lines={8} />
            ) : ranked.length === 0 ? (
              <div className="text-center py-12">
                <Trophy size={32} className="text-muted mx-auto mb-3" />
                <p className="text-muted font-body">
                  No agents registered yet. Be the first to join COVENANT!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header Row */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-mono text-muted uppercase tracking-wider">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-3">Agent</div>
                  <div className="col-span-2 text-right">Reputation</div>
                  <div className="col-span-2 text-right">Tasks</div>
                  <div className="col-span-2 text-right">Staked</div>
                  <div className="col-span-2 text-right">Value</div>
                </div>

                {ranked.map((agent) => {
                  const isMe =
                    agent.address?.toLowerCase() === address?.toLowerCase();
                  return (
                    <div
                      key={agent.address}
                      className={`grid grid-cols-12 gap-3 items-center px-4 py-3 rounded-xl transition-colors ${
                        isMe
                          ? "bg-warning/10 border border-warning/30"
                          : "bg-surface/30 border border-border hover:border-accent/30"
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1">
                        {agent.rank <= 3 ? (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-heading font-bold ${
                              agent.rank === 1
                                ? "bg-warning/20 text-warning"
                                : agent.rank === 2
                                ? "bg-muted/20 text-muted"
                                : "bg-warning/10 text-warning/60"
                            }`}
                          >
                            {agent.rank === 1 ? (
                              <Crown size={16} />
                            ) : agent.rank === 2 ? (
                              <Medal size={16} />
                            ) : (
                              <Medal size={14} />
                            )}
                          </div>
                        ) : (
                          <span className="font-mono text-sm text-muted">
                            #{agent.rank}
                          </span>
                        )}
                      </div>

                      {/* Agent Name */}
                      <div className="col-span-5 sm:col-span-3">
                        <p className={`font-mono text-sm truncate ${isMe ? "text-warning" : "text-foreground"}`}>
                          {agent.name}
                        </p>
                        <p className="font-mono text-[10px] text-muted truncate">
                          {formatAddress(agent.address)}
                        </p>
                      </div>

                      {/* Reputation */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-heading text-lg font-bold text-warning">
                          {Number(agent.reputation)}
                        </p>
                      </div>

                      {/* Tasks */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-mono text-sm text-foreground">
                          {Number(agent.tasksCompleted)}
                          <span className="text-muted"> / </span>
                          <span className="text-danger/60">
                            {Number(agent.tasksFailed)}
                          </span>
                        </p>
                      </div>

                      {/* Staked */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-mono text-sm text-info">
                          {formatEth(agent.stakedAmount)}
                        </p>
                      </div>

                      {/* Value */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-mono text-sm text-muted">
                          {formatEth(agent.totalValueTransferred)} ETH
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Call to Action */}
        <motion.div variants={itemVariants} className="mt-8 text-center">
          <Link href="/marketplace">
            <Button variant="secondary">
              <Zap size={16} />
              Start Earning Reputation
              <ArrowRight size={14} />
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
