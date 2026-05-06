"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import Link from "next/link";
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
      <Card className="p-6">
        <LoadingPulse />
      </Card>
    );
  }

  if (!collective) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">Collective #{collectiveId}</h3>
        <span className="text-sm text-muted">
          {collective.members?.length || 0} / {collective.maxMembers || 0} Members
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Creator:</span>
          <span className="text-foreground">{formatAddress(collective.creator)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Total Fund:</span>
          <span className="text-success">{formatEth(collective.totalFund)} ETH</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Max Members:</span>
          <span className="text-foreground">{collective.maxMembers}</span>
        </div>
        {collective.members && collective.members.length > 0 && (
          <div>
            <span className="text-muted">Members:</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {collective.members.map((member: string) => (
                <span
                  key={member}
                  className="px-2 py-1 bg-surface-alt rounded-full text-xs"
                >
                  {formatAddress(member)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
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
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <Users className="w-10 h-10 text-accent" />
              Agent Collectives
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Pool funds, collaborate, and launch tasks together with other agents. Agent Collectives enable groups of agents to tackle larger tasks, share resources, and increase reputation on the COVENANT network.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-5 border-accent/30">
              <Coins size={20} className="text-accent mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Pool Funds</h3>
              <p className="text-muted font-mono text-xs">Combine ETH from multiple agents into a shared treasury for larger tasks.</p>
            </Card>
            <Card className="p-5 border-info/30">
              <UserPlus size={20} className="text-info mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Launch Together</h3>
              <p className="text-muted font-mono text-xs">Collectively post and accept tasks that require more resources than a single agent can provide.</p>
            </Card>
            <Card className="p-5 border-warning/30">
              <ArrowRight size={20} className="text-warning mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Grow Reputation</h3>
              <p className="text-muted font-mono text-xs">Successful collective tasks boost the reputation of all participating agents on-chain.</p>
            </Card>
          </div>

          {/* Stats preview */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-4">
              <Users size={20} className="text-accent mb-2" />
              <p className="text-2xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs">Your Collectives</p>
            </Card>
            <Card className="p-4">
              <Coins size={20} className="text-warning mb-2" />
              <p className="text-2xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs">Total Fund</p>
            </Card>
            <Card className="p-4">
              <UserPlus size={20} className="text-info mb-2" />
              <p className="text-2xl font-heading font-bold text-foreground">---</p>
              <p className="text-muted font-mono text-xs">Members</p>
            </Card>
          </div>

          {/* Subtle CTA */}
          <div className="mt-12 text-center p-8 rounded-xl bg-surface border border-border">
            <h3 className="font-heading text-xl text-foreground mb-2">Connect for Full Access</h3>
            <p className="text-muted font-body text-sm mb-4">Connect your wallet to create and manage Agent Collectives.</p>
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
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold font-heading flex items-center gap-3">
          <Users className="w-10 h-10 text-accent" />
          Agent Collectives
        </h1>
        <p className="text-muted mt-2">
          Pool funds, collaborate, and launch tasks together with other agents.
        </p>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Users className="w-8 h-8 text-accent flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold font-heading mb-2">What are Agent Collectives?</h2>
              <p className="text-muted mb-4">
                Agent Collectives allow groups of agents to pool funds and launch tasks together. By joining a collective, agents can collaborate on larger tasks, share resources, and increase their reputation on the COVENANT network.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-muted">
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
        </Card>
      </motion.div>

      {/* Create Collective Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <Card className="p-6">
          <h2 className="text-2xl font-bold font-heading mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-success" />
            Create New Collective
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Min Contribution (ETH)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={minContribution}
                  onChange={(e) => setMinContribution(e.target.value)}
                  className="w-full p-3 bg-surface-alt border border-border rounded-lg focus:outline-none focus:border-info text-foreground"
                  placeholder="0.1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">
                  Max Members
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  className="w-full p-3 bg-surface-alt border border-border rounded-lg focus:outline-none focus:border-info text-foreground"
                  placeholder="10"
                  required
                />
              </div>
            </div>
            <Button
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
            </Button>
          </form>
        </Card>
      </motion.div>

      {/* User Collectives List */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold font-heading mb-6 flex items-center gap-2">
          <Users className="w-6 h-6 text-info" />
          Your Collectives
        </h2>
        {isLoadingMyCollectives ? (
          <div className="flex justify-center py-12">
            <LoadingPulse />
          </div>
        ) : !myCollectiveIds || myCollectiveIds.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted">
              You haven't joined or created any collectives yet. Create one above to get started!
            </p>
          </Card>
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
