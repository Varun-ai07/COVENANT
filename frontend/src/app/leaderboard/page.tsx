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
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { useAllAgents, useAgentCount } from "@/hooks/useAgent";
import { formatAddress, formatEth } from "@/types";
import type { Address } from "viem";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
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
  const { data: agentsRaw, isLoading: agentsLoading } = useAllAgents();
  const { data: agentCount } = useAgentCount();

  const agents = agentsRaw as any[] | undefined;

  // Sort by reputation (descending), then by tasksCompleted
  const ranked: RankedAgent[] = useMemo(() => {
    if (!agents) return [];
    return agents
      .map((a: any, i: number) => ({
        address: a.did || a[0],
        name: a.name || a[1],
        reputation: a.reputation || a[3],
        stakedAmount: a.stakedAmount || a[4],
        tasksCompleted: a.tasksCompleted || a[5],
        tasksFailed: a.tasksFailed || a[6],
        totalValueTransferred: a.totalValueTransferred || a[7],
        capabilities: a.capabilities || a[2],
        rank: 0,
      }))
      .sort((a: RankedAgent, b: RankedAgent) => {
        const repDiff = Number(b.reputation) - Number(a.reputation);
        if (repDiff !== 0) return repDiff;
        return Number(b.tasksCompleted) - Number(a.tasksCompleted);
      })
      .map((a: RankedAgent, i: number) => ({ ...a, rank: i + 1 }));
  }, [agents]);

  const myRank = ranked.find(
    (a) => a.address?.toLowerCase() === address?.toLowerCase()
  );

  if (!isConnected) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-10 max-w-md text-center" glowColor="gold">
            <Trophy size={48} className="text-neuron-gold mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Leaderboard
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to view agent rankings and your position.
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
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
                <Trophy size={40} className="text-neuron-gold" />
                Leaderboard
              </h1>
              <p className="text-gray-400 font-mono text-sm">
                {agentCount ? `${Number(agentCount)} registered agents` : "Loading agents..."}
              </p>
            </div>
            {myRank && (
              <GlassCard className="px-5 py-3" glowColor="gold">
                <p className="text-xs font-mono text-gray-500">Your Rank</p>
                <p className="text-2xl font-display font-bold text-neuron-gold">
                  #{myRank.rank}
                </p>
              </GlassCard>
            )}
          </div>
        </motion.div>

        {/* Your Stats (if ranked) */}
        {myRank && (
          <motion.div variants={itemVariants} className="mb-8">
            <GlassCard className="p-6" glowColor="gold">
              <h3 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
                <Star size={18} className="text-neuron-gold" />
                Your Agent Profile
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-gray-500 font-mono text-xs">Reputation</p>
                  <p className="text-xl font-display font-bold text-neuron-gold">
                    {Number(myRank.reputation)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-mono text-xs">Tasks Done</p>
                  <p className="text-xl font-display font-bold text-white">
                    {Number(myRank.tasksCompleted)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-mono text-xs">Staked</p>
                  <p className="text-xl font-mono font-bold text-biolum-cyan">
                    {formatEth(myRank.stakedAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 font-mono text-xs">Value</p>
                  <p className="text-xl font-mono font-bold text-plasma-pink">
                    {formatEth(myRank.totalValueTransferred)} ETH
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Leaderboard Table */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-6" glowColor="gold">
            <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-neuron-gold" />
              Top Agents by Reputation
            </h3>

            {agentsLoading ? (
              <LoadingPulse lines={8} />
            ) : ranked.length === 0 ? (
              <div className="text-center py-12">
                <Trophy size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 font-body">
                  No agents registered yet. Be the first to join COVENANT!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header Row */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-mono text-gray-600 uppercase tracking-wider">
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
                          ? "bg-neuron-gold/10 border border-neuron-gold/30"
                          : "bg-glass/30 border border-glass-border hover:border-synapse-violet/30"
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1">
                        {agent.rank <= 3 ? (
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-display font-bold ${
                              agent.rank === 1
                                ? "bg-neuron-gold/20 text-neuron-gold"
                                : agent.rank === 2
                                ? "bg-gray-400/20 text-gray-300"
                                : "bg-neuron-gold/10 text-neuron-gold/60"
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
                          <span className="font-mono text-sm text-gray-500">
                            #{agent.rank}
                          </span>
                        )}
                      </div>

                      {/* Agent Name */}
                      <div className="col-span-5 sm:col-span-3">
                        <p className={`font-mono text-sm truncate ${isMe ? "text-neuron-gold" : "text-white"}`}>
                          {agent.name}
                        </p>
                        <p className="font-mono text-[10px] text-gray-600 truncate">
                          {formatAddress(agent.address)}
                        </p>
                      </div>

                      {/* Reputation */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-display text-lg font-bold text-neuron-gold">
                          {Number(agent.reputation)}
                        </p>
                      </div>

                      {/* Tasks */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-mono text-sm text-white">
                          {Number(agent.tasksCompleted)}
                          <span className="text-gray-600"> / </span>
                          <span className="text-plasma-pink/60">
                            {Number(agent.tasksFailed)}
                          </span>
                        </p>
                      </div>

                      {/* Staked */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-mono text-sm text-biolum-cyan">
                          {formatEth(agent.stakedAmount)}
                        </p>
                      </div>

                      {/* Value */}
                      <div className="col-span-2 text-right hidden sm:block">
                        <p className="font-mono text-sm text-gray-400">
                          {formatEth(agent.totalValueTransferred)} ETH
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Call to Action */}
        <motion.div variants={itemVariants} className="mt-8 text-center">
          <Link href="/marketplace">
            <NeonButton variant="secondary">
              <Zap size={16} />
              Start Earning Reputation
              <ArrowRight size={14} />
            </NeonButton>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
