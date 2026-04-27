"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useParallelBatch, TaskBatch } from "@/hooks/useParallelBatch";
import { useToast } from "@/components/Toast";
import { formatEther } from "viem";

const STATUS_LABELS: Record<number, string> = {
  0: "Pending",
  1: "Creating",
  2: "Active",
  3: "Completed",
  4: "Cancelled",
};

export function BatchMonitor() {
  const { address, isConnected } = useAccount();
  const {
    batchCounter,
    useBatch,
    useBatchStatus,
    createBatch,
    aggregateResults,
    useWatchBatchCreated,
    useWatchBatchVerified,
    isCreating,
    isConfirmingCreate,
    isAggregating,
  } = useParallelBatch();

  const { addToast } = useToast();

  const [batches, setBatches] = useState<TaskBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<bigint | null>(null);

  // Event watchers (call at top level)
  useWatchBatchCreated((batchId) => {
    addToast({ type: "success", title: "Batch Created", message: `Batch #${batchId} created` });
  });

  useWatchBatchVerified((batchId, results) => {
    const passed = results.filter(r => r).length;
    addToast({ type: "success", title: "Batch Verified", message: `Batch #${batchId}: ${passed}/${results.length} passed` });
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center">
          <h2 className="font-silkscreen text-4xl text-fuchsia-300 mb-4">CONNECT TO ACCESS BATCHES</h2>
          <p className="text-white/60">Connect your wallet to create and monitor parallel task batches.</p>
        </div>
      </div>
    );
  }

  const { batch: selectedBatch } = useBatch(selectedBatchId ?? undefined);
  const { status: batchStatus } = useBatchStatus(selectedBatchId ?? undefined);

  const handleCreateBatch = async (
    workers: string[],
    payments: bigint[],
    deadlines: bigint[],
    descriptionHashes: string[],
    aggregationSpec: string
  ) => {
    try {
      createBatch(workers, payments, deadlines, descriptionHashes, aggregationSpec);
      addToast({ type: "info", title: "Creating Batch", message: `Creating batch of ${workers.length} subtasks...` });
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not create batch" });
    }
  };

  const handleAggregate = async (batchId: bigint, finalHash: string) => {
    try {
      aggregateResults(batchId, finalHash);
      addToast({ type: "info", title: "Aggregating...", message: "Aggregating batch results" });
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not aggregate results" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="font-silkscreen text-5xl text-violet-300 mb-4">PARALLEL BATCH MONITOR</h1>
          <p className="text-white/70 text-lg">
            Create and monitor parallel task batches for high-throughput processing.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Batches List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-silkscreen text-2xl text-fuchsia-300">Active Batches ({Number(batchCounter) || 0})</h2>
              <button className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl shadow-lg hover:from-violet-500 hover:to-fuchsia-500 transition-all">
                Create Batch
              </button>
            </div>

            <div className="space-y-4">
              {batches.length === 0 ? (
                <div className="glass-panel p-8 text-center border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
                  <p className="text-white/60">No batches created yet.</p>
                </div>
              ) : (
                batches.map((batch) => (
                  <div
                    key={Number(batch.batchId)}
                    className={`glass-panel p-6 border ${selectedBatchId === batch.batchId ? 'border-violet-400/60' : 'border-violet-500/20'} bg-black/20 backdrop-blur-xl rounded-2xl cursor-pointer hover:border-violet-400/40 transition-all`}
                    onClick={() => setSelectedBatchId(batch.batchId)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="font-silkscreen text-violet-300">Batch #{batch.batchId}</span>
                        <div className="text-sm text-white/60 mt-1">
                          Client: {batch.client.slice(0, 10)}...
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        batch.status === 3 ? 'bg-green-500/20 text-green-300' :
                        batch.status === 2 ? 'bg-blue-500/20 text-blue-300' :
                        'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {STATUS_LABELS[batch.status] || "Unknown"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-white/60">Budget:</span>
                        <span className="ml-2 text-fuchsia-300">{formatEther(batch.totalBudget)} ETH</span>
                      </div>
                      <div>
                        <span className="text-white/60">Subtasks:</span>
                        <span className="ml-2 text-violet-300">{batch.tasks.length}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Batch Details */}
          <div className="space-y-6">
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl sticky top-8">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">
                {selectedBatch ? `Batch #${selectedBatch.batchId}` : 'Select a Batch'}
              </h3>

              {selectedBatch ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-white/60">Status</span>
                      <span className="text-violet-300">{STATUS_LABELS[selectedBatch.status]}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Budget</span>
                      <span className="text-fuchsia-300">{formatEther(selectedBatch.totalBudget)} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Subtasks</span>
                      <span className="text-violet-300">{selectedBatch.tasks.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Created</span>
                      <span className="text-white">{new Date(Number(selectedBatch.createdAt) * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {batchStatus !== undefined && (
                    <div className="pt-4 border-t border-violet-500/20">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/70">Batch Status Code</span>
                        <span className="font-mono text-violet-300">{batchStatus}</span>
                      </div>
                      <div className="w-full bg-violet-900/30 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                          style={{ width: `${(batchStatus / 4) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-violet-500/20">
                    <h4 className="text-fuchsia-300 font-semibold mb-3">Subtasks</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedBatch.tasks.map((taskId, idx) => (
                        <div key={taskId.toString()} className="bg-black/30 p-3 rounded-lg text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/70">Subtask #{idx + 1}</span>
                            <span className="text-violet-300">ID: {taskId.toString().slice(-4)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-violet-500/20">
                    <h4 className="text-fuchsia-300 font-semibold mb-3">Aggregation</h4>
                    <div className="bg-black/30 p-3 rounded-lg text-xs font-mono text-white/50 break-all mb-3">
                      {selectedBatch.aggregationSpec || "No spec provided"}
                    </div>
                    <button
                      onClick={() => handleAggregate(selectedBatch.batchId, "0xplaceholder")}
                      disabled={isAggregating}
                      className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold rounded-xl hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50 transition-all"
                    >
                      {isAggregating ? "Aggregating..." : "Aggregate Results"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-white/50 text-sm">Select a batch to view details</p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">System Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Total Batches</span>
                  <span className="text-violet-300">{Number(batchCounter) || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Your Batches</span>
                  <span className="text-fuchsia-300">{batches.filter(b => b.client.toLowerCase() === address?.toLowerCase()).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
