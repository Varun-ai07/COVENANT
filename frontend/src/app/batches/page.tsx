"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import {
  Layers,
  Plus,
  LogIn,
  ArrowRight,
  Zap,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useParallelBatch, useBatchCounter, useCreateBatch } from "@/hooks/useParallelBatch";
import { formatAddress } from "@/types";
import type { Address } from "viem";

const STATUS_LABELS: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
  0: { label: "Created", color: "text-neon-blue", icon: <Clock className="w-4 h-4" /> },
  1: { label: "In Progress", color: "text-neon-purple", icon: <Zap className="w-4 h-4" /> },
  2: { label: "Completed", color: "text-neon-green", icon: <CheckCircle className="w-4 h-4" /> },
  3: { label: "Failed", color: "text-red-400", icon: <AlertTriangle className="w-4 h-4" /> },
};

interface BatchCardProps {
  batchId: number;
}

function BatchCard({ batchId }: BatchCardProps) {
  const { data: batch, isLoading } = useParallelBatch(batchId);

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <LoadingPulse />
      </GlassCard>
    );
  }

  if (!batch) {
    return null;
  }

  const status = STATUS_LABELS[batch.status] || STATUS_LABELS[0];

  return (
    <GlassCard className="p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">Batch #{batchId}</h3>
        <span className={`flex items-center gap-1 text-sm ${status.color}`}>
          {status.icon}
          {status.label}
        </span>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Creator:</span>
          <span className="text-white">{formatAddress(batch.creator)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Workers:</span>
          <span className="text-neon-green">{Number(batch.workerCount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Task IDs:</span>
          <span className="text-white truncate max-w-[200px]">
            {batch.taskIds?.length > 0
              ? batch.taskIds.map((id) => `#${id.toString()}`).join(", ")
              : "—"}
          </span>
        </div>
        {batch.resultHash &&
          batch.resultHash !== "0x0000000000000000000000000000000000000000000000000000000000000000" && (
            <div className="flex justify-between">
              <span className="text-gray-400">Result Hash:</span>
              <span className="text-white font-mono text-xs truncate max-w-[200px]">
                {batch.resultHash.slice(0, 10)}...{batch.resultHash.slice(-8)}
              </span>
            </div>
          )}
      </div>
    </GlassCard>
  );
}

export default function BatchesPage() {
  const { address, isConnected } = useAccount();
  const { count: batchCounter, isLoading: isLoadingCounter } = useBatchCounter();
  const { createBatch, isPending: isCreating } = useCreateBatch();

  const [workerAddresses, setWorkerAddresses] = useState("");
  const [taskIdsInput, setTaskIdsInput] = useState("");
  const [deadlinesInput, setDeadlinesInput] = useState("");
  const [deliverableHashesInput, setDeliverableHashesInput] = useState("");
  const [resultHashInput, setResultHashInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerAddresses || !taskIdsInput || !deadlinesInput || !deliverableHashesInput || !resultHashInput) return;

    const workers = workerAddresses
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean) as Address[];
    const taskIds = taskIdsInput
      .split(",")
      .map((id) => BigInt(id.trim()));
    const deadlines = deadlinesInput
      .split(",")
      .map((d) => BigInt(d.trim()));
    const deliverableHashes = deliverableHashesInput
      .split(",")
      .map((h) => h.trim() as `0x${string}`);
    const resultHash = resultHashInput.trim() as `0x${string}`;

    createBatch(workers, taskIds, deadlines, deliverableHashes, resultHash);

    setWorkerAddresses("");
    setTaskIdsInput("");
    setDeadlinesInput("");
    setDeliverableHashesInput("");
    setResultHashInput("");
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <GlassCard className="p-8 text-center max-w-md w-full">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-neon-blue" />
          <h2 className="text-2xl font-bold mb-2">Connect Wallet</h2>
          <p className="text-gray-400">
            Please connect your wallet to view and manage Parallel Task Batches.
          </p>
        </GlassCard>
      </div>
    );
  }

  const batchIds = batchCounter ? Array.from({ length: Number(batchCounter) }, (_, i) => i) : [];

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Layers className="w-10 h-10 text-neon-purple" />
          Parallel Task Batches
        </h1>
        <p className="text-gray-400 mt-2">
          Execute multiple tasks in parallel across distributed agent workers with aggregated on-chain verification.
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
            <Layers className="w-8 h-8 text-neon-purple flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-2xl font-bold mb-2">What are Parallel Task Batches?</h2>
              <p className="text-gray-300 mb-4">
                Parallel Task Batches let you distribute work across multiple agent workers simultaneously.
                Each batch groups related tasks with individual deadlines and deliverable hashes, producing a single
                aggregated result verified on-chain via the COVENANT protocol.
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>Parallel execution across workers</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>Multi-worker distribution</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4" />
                  <span>Aggregated on-chain verification</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Create Batch Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <GlassCard className="p-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Plus className="w-6 h-6 text-neon-green" />
            Create New Batch
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Worker Addresses (comma-separated)
              </label>
              <input
                type="text"
                value={workerAddresses}
                onChange={(e) => setWorkerAddresses(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                placeholder="0xabc..., 0xdef..."
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Task IDs (comma-separated)
                </label>
                <input
                  type="text"
                  value={taskIdsInput}
                  onChange={(e) => setTaskIdsInput(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                  placeholder="1, 2, 3"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Deadlines (Unix timestamps, comma-separated)
                </label>
                <input
                  type="text"
                  value={deadlinesInput}
                  onChange={(e) => setDeadlinesInput(e.target.value)}
                  className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                  placeholder="1700000000, 1700003600, ..."
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Deliverable Hashes (comma-separated bytes32)
              </label>
              <input
                type="text"
                value={deliverableHashesInput}
                onChange={(e) => setDeliverableHashesInput(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                placeholder="0xabc..., 0xdef..."
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Result Hash (bytes32)
              </label>
              <input
                type="text"
                value={resultHashInput}
                onChange={(e) => setResultHashInput(e.target.value)}
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-neon-blue text-white"
                placeholder="0x..."
                required
              />
            </div>
            <NeonButton
              type="submit"
              disabled={
                isCreating ||
                !workerAddresses ||
                !taskIdsInput ||
                !deadlinesInput ||
                !deliverableHashesInput ||
                !resultHashInput
              }
              className="w-full md:w-auto"
            >
              {isCreating ? (
                <>
                  <LoadingPulse className="mr-2" />
                  Creating Batch...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Batch
                </>
              )}
            </NeonButton>
          </form>
        </GlassCard>
      </motion.div>

      {/* All Batches List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Layers className="w-6 h-6 text-neon-blue" />
          All Batches
        </h2>
        {isLoadingCounter ? (
          <div className="flex justify-center py-12">
            <LoadingPulse />
          </div>
        ) : batchIds.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-gray-400">
              No batches have been created yet. Use the form above to create your first parallel task batch!
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {batchIds.map((id) => (
              <BatchCard key={id} batchId={id} />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
