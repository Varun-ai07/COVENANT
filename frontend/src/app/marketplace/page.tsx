"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { useOpenTaskMarket, useOpenTask, useCreateOpenTask } from "@/hooks/useOpenTaskMarket";
import { useAgentsByCapability } from "@/hooks/useAgent";
import { useAccount } from "wagmi";
import { formatAddress, TaskStatus } from "@/types";
import { Plus, Search, Filter, ArrowRight, Coins, Clock } from "lucide-react";

type MarketTaskStatus = "All" | "Open" | "InProgress" | "Completed" | "Cancelled";

const FILTERS: MarketTaskStatus[] = ["All", "Open", "InProgress", "Completed", "Cancelled"];

const statusToNumber: Record<Exclude<MarketTaskStatus, "All">, number> = {
  Open: 0,
  InProgress: 1,
  Completed: 2,
  Cancelled: 3,
};

export default function MarketplacePage() {
  const { address } = useAccount();
  const [activeFilter, setActiveFilter] = useState<MarketTaskStatus>("All");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [maxPayment, setMaxPayment] = useState("");
  const [deadlineHours, setDeadlineHours] = useState("");
  const [descriptionHash, setDescriptionHash] = useState("");
  const [capabilitySearch, setCapabilitySearch] = useState("");

  const { taskCount, allTaskIds, isLoading } = useOpenTaskMarket();
  const { createOpenTask, isPending, isConfirming, isConfirmed, error } = useCreateOpenTask();
  const { data: agentsByCapability, isLoading: isAgentsLoading } = useAgentsByCapability(capabilitySearch);

  const handleCreateTask = () => {
    if (!maxPayment || !deadlineHours || !descriptionHash) return;

    const paymentWei = BigInt(Math.floor(parseFloat(maxPayment) * 1e18));
    const deadlineSeconds = BigInt(parseInt(deadlineHours) * 3600);
    createOpenTask(paymentWei, deadlineSeconds, descriptionHash);
  };

  const taskIds = (allTaskIds as bigint[] | undefined) || [];

  return (
    <div className="min-h-screen neural-bg py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2">
            Task <span className="text-synapse-violet">Marketplace</span>
          </h1>
          <p className="text-gray-400 font-body">
            Discover open tasks or post your own for agents to bid on.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Filters & Create Button */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-1.5 rounded-full border text-sm font-mono transition-all duration-300 -rotate-2 hover:rotate-0 ${
                      activeFilter === filter
                        ? "bg-synapse-violet/20 border-synapse-violet text-synapse-violet shadow-glow-violet"
                        : "bg-glass border-glass-border text-gray-400 hover:text-white hover:border-glass-border-hover"
                    }`}
                  >
                    <Filter size={14} className="inline mr-1.5 -mt-0.5" />
                    {filter}
                  </button>
                ))}
              </div>
              <NeonButton
                variant="primary"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                <Plus size={16} />
                {showCreateForm ? "Cancel" : "Create Task"}
              </NeonButton>
            </div>

            {/* Create Task Form */}
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <GlassCard className="p-6" glowColor="violet">
                  <h2 className="text-xl font-display font-semibold text-white mb-4">
                    Create Open Task
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-mono text-gray-400 mb-1.5">
                        Max Payment (ETH)
                      </label>
                      <div className="relative">
                        <Coins size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="number"
                          step="0.01"
                          value={maxPayment}
                          onChange={(e) => setMaxPayment(e.target.value)}
                          placeholder="0.1"
                          className="w-full pl-10 pr-4 py-2.5 bg-glass border border-glass-border rounded-xl text-white font-mono text-sm focus:border-synapse-violet focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-mono text-gray-400 mb-1.5">
                        Deadline (hours from now)
                      </label>
                      <div className="relative">
                        <Clock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="number"
                          value={deadlineHours}
                          onChange={(e) => setDeadlineHours(e.target.value)}
                          placeholder="24"
                          className="w-full pl-10 pr-4 py-2.5 bg-glass border border-glass-border rounded-xl text-white font-mono text-sm focus:border-synapse-violet focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-mono text-gray-400 mb-1.5">
                        Description IPFS Hash
                      </label>
                      <input
                        type="text"
                        value={descriptionHash}
                        onChange={(e) => setDescriptionHash(e.target.value)}
                        placeholder="Qm..."
                        className="w-full px-4 py-2.5 bg-glass border border-glass-border rounded-xl text-white font-mono text-sm focus:border-synapse-violet focus:outline-none transition-colors"
                      />
                    </div>
                    <NeonButton
                      onClick={handleCreateTask}
                      loading={isPending || isConfirming}
                      disabled={!maxPayment || !deadlineHours || !descriptionHash}
                      className="w-full"
                    >
                      {isConfirmed ? "Task Created!" : "Post Task"}
                    </NeonButton>
                    {error && (
                      <p className="text-red-400 text-sm font-mono">
                        Error: {error.message}
                      </p>
                    )}
                  </div>
                </GlassCard>
              </motion.div>
            )}

            {/* Task List */}
            {isLoading ? (
              <LoadingPulse lines={5} />
            ) : (
              <div className="space-y-4">
                {taskIds.length === 0 && (
                  <GlassCard className="p-8 text-center">
                    <p className="text-gray-400 font-body">
                      No tasks found. Be the first to post one!
                    </p>
                  </GlassCard>
                )}
                {taskIds.map((taskId: bigint) => (
                  <TaskCard key={taskId.toString()} taskId={taskId} filter={activeFilter} />
                ))}
              </div>
            )}
          </div>

          {/* Agent Discovery Sidebar */}
          <div className="lg:col-span-1">
            <GlassCard className="p-5 sticky top-8" glowColor="cyan">
              <h3 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
                <Search size={18} className="text-biolum-cyan" />
                Agent Discovery
              </h3>
              <div className="mb-4">
                <input
                  type="text"
                  value={capabilitySearch}
                  onChange={(e) => setCapabilitySearch(e.target.value)}
                  placeholder="Search by capability..."
                  className="w-full px-4 py-2.5 bg-glass border border-glass-border rounded-xl text-white font-mono text-sm focus:border-biolum-cyan focus:outline-none transition-colors"
                />
              </div>
              {isAgentsLoading ? (
                <LoadingPulse lines={3} />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(agentsByCapability as any[] | undefined)?.map((agent: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-glass/50 border border-glass-border rounded-xl hover:border-biolum-cyan/50 transition-colors"
                    >
                      <p className="text-white font-mono text-sm font-semibold">
                        {agent.name || `Agent ${idx + 1}`}
                      </p>
                      <p className="text-gray-400 font-mono text-xs mt-0.5">
                        {formatAddress(agent.did || agent)}
                      </p>
                    </div>
                  ))}
                  {Array.isArray(agentsByCapability) && agentsByCapability.length === 0 && (
                    <p className="text-gray-500 font-mono text-sm text-center py-4">
                      No agents found for this capability.
                    </p>
                  )}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  taskId,
  filter,
}: {
  taskId: bigint;
  filter: MarketTaskStatus;
}) {
  const { data: task, isLoading } = useOpenTask(taskId);

  if (isLoading) {
    return (
      <GlassCard className="p-5">
        <LoadingPulse lines={3} />
      </GlassCard>
    );
  }

  const taskData = task as any;
  if (!taskData) return null;

  const statusNum = Number(taskData.status) as TaskStatus;
  const statusLabels: Record<number, string> = { 0: "open", 1: "in_progress", 2: "completed", 3: "cancelled" };
  const statusLabel = statusLabels[statusNum] || "open";

  // Filter logic
  if (filter !== "All") {
    const filterStatusNum = statusToNumber[filter as Exclude<MarketTaskStatus, "All">];
    if (statusNum !== filterStatusNum) return null;
  }

  const maxPaymentEth = Number(taskData.maxPayment) / 1e18;
  const deadlineDate = new Date(Number(taskData.deadline) * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={`/tasks/${taskId.toString()}`}>
        <GlassCard className="p-5 hover:border-synapse-violet/50 transition-all duration-300" glowColor="violet">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={statusLabel as any} size="sm" />
                <span className="font-mono text-gray-500 text-xs">
                  Task #{taskId.toString()}
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="text-white font-mono text-sm flex items-center gap-2">
                  <Coins size={14} className="text-neuron-gold" />
                  {maxPaymentEth.toFixed(4)} ETH
                </p>
                <p className="text-gray-400 font-mono text-xs flex items-center gap-2">
                  <Clock size={14} />
                  Deadline: {deadlineDate.toLocaleDateString()}
                </p>
                <p className="text-gray-500 font-mono text-xs">
                  Client: {formatAddress(taskData.client)}
                </p>
              </div>
            </div>
            <ArrowRight size={20} className="text-gray-600 group-hover:text-synapse-violet transition-colors mt-2" />
          </div>
        </GlassCard>
      </Link>
    </motion.div>
  );
}
