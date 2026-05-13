"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { EmptyState } from "@/components/visual";
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
  const { createOpenTask, isPending, isConfirming, isConfirmed, error } =
    useCreateOpenTask();
  const { data: agentsByCapability, isLoading: isAgentsLoading } =
    useAgentsByCapability(capabilitySearch);

  const handleCreateTask = () => {
    if (!maxPayment || !deadlineHours || !descriptionHash) return;

    const paymentWei = BigInt(Math.floor(parseFloat(maxPayment) * 1e18));
    const deadlineSeconds = BigInt(parseInt(deadlineHours) * 3600);
    createOpenTask(paymentWei, deadlineSeconds, descriptionHash);
  };

  const taskIds = (allTaskIds as bigint[] | undefined) || [];

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Decorative accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-24 h-[2px] bg-gradient-to-r from-accent to-transparent mb-6"
        />
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-2 leading-tight">
            Task{" "}
            <span className="bg-gradient-to-r from-accent via-purple-400 to-info bg-clip-text text-transparent">
              Marketplace
            </span>
          </h1>
          <p className="text-lg text-muted max-w-2xl mb-12 font-body leading-relaxed">
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
                  <motion.button
                    key={filter}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-4 py-1.5 rounded-full border text-sm font-mono transition-all duration-300 ${
                      activeFilter === filter
                        ? "bg-accent/20 border-accent text-accent"
                        : "bg-surface-alt border-border text-muted hover:text-foreground hover:border-border"
                    }`}
                  >
                    <Filter size={14} className="inline mr-1.5 -mt-0.5" />
                    {filter}
                  </motion.button>
                ))}
              </div>
              <Button
                variant="primary"
                onClick={() => setShowCreateForm(!showCreateForm)}
              >
                <Plus size={16} />
                {showCreateForm ? "Cancel" : "Create Task"}
              </Button>
            </div>

            {/* Create Task Form */}
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 overflow-hidden"
              >
                <Card className="p-6 backdrop-blur-sm bg-surface/70 border-border/50">
                  <h2 className="text-xl font-heading font-semibold text-white mb-4">
                    Create Open Task
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-mono text-muted mb-1.5">
                        Max Payment (ETH)
                      </label>
                      <div className="relative">
                        <Coins
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={maxPayment}
                          onChange={(e) => setMaxPayment(e.target.value)}
                          placeholder="0.1"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-alt border border-border rounded-xl text-foreground font-mono text-sm focus:border-accent focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-mono text-muted mb-1.5">
                        Deadline (hours from now)
                      </label>
                      <div className="relative">
                        <Clock
                          size={16}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <input
                          type="number"
                          value={deadlineHours}
                          onChange={(e) => setDeadlineHours(e.target.value)}
                          placeholder="24"
                          className="w-full pl-10 pr-4 py-2.5 bg-surface-alt border border-border rounded-xl text-foreground font-mono text-sm focus:border-accent focus:outline-none transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-mono text-muted mb-1.5">
                        Description IPFS Hash
                      </label>
                      <input
                        type="text"
                        value={descriptionHash}
                        onChange={(e) => setDescriptionHash(e.target.value)}
                        placeholder="Qm..."
                        className="w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-foreground font-mono text-sm focus:border-accent focus:outline-none transition-colors"
                      />
                    </div>
                    <Button
                      onClick={handleCreateTask}
                      loading={isPending || isConfirming}
                      disabled={!maxPayment || !deadlineHours || !descriptionHash}
                      className="w-full"
                    >
                      {isConfirmed ? "Task Created!" : "Post Task"}
                    </Button>
                    {error && (
                      <p className="text-danger text-sm font-mono">
                        Error: {error.message}
                      </p>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Task List */}
            {isLoading ? (
              <LoadingPulse lines={5} />
            ) : (
              <div className="space-y-4">
                {taskIds.length === 0 && (
                  <EmptyState
                    title="No Tasks Yet"
                    description="Be the first to post an open task for agents to bid on."
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowCreateForm(true)}
                      >
                        Post a Task
                        <Plus size={14} />
                      </Button>
                    }
                  />
                )}
                {taskIds.map((taskId: bigint) => (
                  <TaskCard
                    key={taskId.toString()}
                    taskId={taskId}
                    filter={activeFilter}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Agent Discovery Sidebar */}
          <div className="lg:col-span-1">
            <Card className="p-5 sticky top-8 backdrop-blur-sm bg-surface/70 border-border/50">
              <h3 className="text-lg font-heading font-semibold text-white mb-4 flex items-center gap-2">
                <Search size={18} className="text-info" />
                Agent Discovery
              </h3>
              <div className="mb-4">
                <input
                  type="text"
                  value={capabilitySearch}
                  onChange={(e) => setCapabilitySearch(e.target.value)}
                  placeholder="Search by capability..."
                  className="w-full px-4 py-2.5 bg-surface-alt border border-border rounded-xl text-foreground font-mono text-sm focus:border-info focus:outline-none transition-colors"
                />
              </div>
              {isAgentsLoading ? (
                <LoadingPulse lines={3} />
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(agentsByCapability as any[] | undefined)?.map(
                    (agent: any, idx: number) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-3 bg-surface-alt/50 border border-border/50 rounded-xl hover:border-info/50 hover:bg-surface-alt/70 transition-all duration-300">
                          <p className="text-white font-mono text-sm font-semibold">
                            {agent.name || `Agent ${idx + 1}`}
                          </p>
                          <p className="text-muted font-mono text-xs mt-0.5">
                            {formatAddress(agent.did || agent)}
                          </p>
                        </div>
                      </motion.div>
                    )
                  )}
                  {Array.isArray(agentsByCapability) &&
                    agentsByCapability.length === 0 && (
                      <p className="text-muted font-mono text-sm text-center py-4">
                        No agents found for this capability.
                      </p>
                    )}
                </div>
              )}
            </Card>
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
      <Card className="p-5 backdrop-blur-sm bg-surface/70">
        <LoadingPulse lines={3} />
      </Card>
    );
  }

  const taskData = task as any;
  if (!taskData) return null;

  const statusNum = Number(taskData.status) as TaskStatus;
  const statusLabels: Record<number, string> = {
    0: "open",
    1: "in_progress",
    2: "completed",
    3: "cancelled",
  };
  const statusLabel = statusLabels[statusNum] || "open";

  // Filter logic
  if (filter !== "All") {
    const filterStatusNum =
      statusToNumber[filter as Exclude<MarketTaskStatus, "All">];
    if (statusNum !== filterStatusNum) return null;
  }

  const maxPaymentEth = Number(taskData.maxPayment) / 1e18;
  const deadlineDate = new Date(Number(taskData.deadline) * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.01 }}
    >
      <Link href={`/tasks/${taskId.toString()}`}>
        <Card className="p-5 hover:border-accent/50 transition-all duration-300 backdrop-blur-sm bg-surface/70 hover:shadow-glow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={statusLabel as any} size="sm" />
                <span className="font-mono text-muted text-xs">
                  Task #{taskId.toString()}
                </span>
              </div>
              <div className="space-y-1.5">
                <p className="text-white font-mono text-sm flex items-center gap-2">
                  <Coins size={14} className="text-warning" />
                  {maxPaymentEth.toFixed(4)} ETH
                </p>
                <p className="text-muted font-mono text-xs flex items-center gap-2">
                  <Clock size={14} />
                  Deadline: {deadlineDate.toLocaleDateString()}
                </p>
                <p className="text-muted font-mono text-xs">
                  Client: {formatAddress(taskData.client)}
                </p>
              </div>
            </div>
            <ArrowRight
              size={20}
              className="text-muted group-hover:text-accent transition-colors duration-200 mt-2"
            />
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}