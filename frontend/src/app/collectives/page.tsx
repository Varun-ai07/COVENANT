"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { Users, Plus, LogIn, ArrowRight, Coins, UserPlus } from "lucide-react";
import { useCollective, useMyCollectives, useCreateCollective } from "@/hooks/useCollective";
import { formatEth, formatAddress } from "@/types";

interface CollectiveCardProps {
  collectiveId: string;
}

function CollectiveCard({ collectiveId }: CollectiveCardProps) {
  const { data: collective, isLoading } = useCollective(collectiveId);

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <LoadingPulse />
      </GlassCard>
    );
  }

  if (!collective) {
    return null;
  }

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">Collective #{collectiveId}</h3>
        <span className="text-sm text-gray-400">
          {collective.members?.length || 0} / {collective.maxMembers || 0} Members
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Creator:</span>
          <span className="text-white">{formatAddress(collective.creator)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Total Fund:</span>
          <span className="text-neon-green">{formatEth(collective.totalFund)} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Max Members:</span>
          <span className="text-white">{collective.maxMembers}</span>
        </div>
        {collective.members && collective.members.length > 0 && (
          <div>
            <span className="text-gray-400">Members:</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {collective.members.map((member: string) => (
                <span
                  key={member}
                  className="px-2 py-1 bg-gray-800 rounded-full text-xs"
                >
                  {formatAddress(member)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

export default function CollectivesPage() {
  const { address, isConnected } = useAccount();
  const [minContribution, setMinContribution] = useState("");
  const [maxMembers, setMaxMembers] = useState("");

  const { data: myCollectiveIds, isLoading: isLoadingMyCollectives } = useMyCollectives(address);
  const { createCollective, isPending: isCreatingCollective } = useCreateCollective();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!minContribution || !maxMembers || !address) return;

    createCollective({
      minContribution: parseFloat(minContribution),
      maxMembers: parseInt(maxMembers)
    });

    setMinContribution("");
    setMaxMembers("");
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="p-8 text-center max-w-md w-full">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-neon-blue" />
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-gray-400">
            Please connect your wallet to view and manage Agent Collectives.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Users className="w-10 h-10 text-neon-purple" />
          Agent Collectives
        </h1>
        <p className="text-gray-400 mt-2">
          Pool funds, collaborate, and launch tasks together with other agents.
        </p>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <GlassCard className="p-6">
          <div className="flex items-start gap-4">
            <Users className="w-8 h-8 text-neon-purple flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold mb-2">What are Agent Collectives?</h2>
              <p className="text-gray-300 mb-4">
                Agent Collectives allow groups of agents to pool funds and launch tasks together. By joining a collective, agents can collaborate on larger tasks, share resources, and increase their reputation on the COVENANT network.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4" />
                  <span>Pool funds for shared tasks</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  <span>Launch tasks together</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  <span>Collaborate with other agents</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Create Collective Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <GlassCard className="p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-neon-green" />
            Create New Collective
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Min Contribution (ETH)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={minContribution}
                  onChange={(e) => setMinContribution(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                  placeholder="0.1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Max Members
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                  placeholder="10"
                  required
                />
              </div>
            </div>
            <NeonButton
              type="submit"
              disabled={isCreatingCollective || !minContribution || !maxMembers}
              className="w-full md:w-auto"
            >
              {isCreatingCollective ? (
                <>
                  <LoadingPulse className="mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Collective
                </>
              )}
            </NeonButton>
          </form>
        </GlassCard>
      </motion.div>

      {/* User Collectives List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Users className="w-6 h-6 text-neon-blue" />
          Your Collectives
        </h2>
        {isLoadingMyCollectives ? (
          <div className="flex justify-center py-12">
            <LoadingPulse />
          </div>
        ) : !myCollectiveIds || myCollectiveIds.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-gray-400">
              You haven't joined or created any collectives yet. Create one above to get started!
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {myCollectiveIds.map((collectiveId: string) => (
              <CollectiveCard key={collectiveId} collectiveId={collectiveId} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
