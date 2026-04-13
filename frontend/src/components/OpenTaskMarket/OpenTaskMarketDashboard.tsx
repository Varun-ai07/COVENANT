"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useOpenTaskMarket, OpenTask, Bid } from "@/hooks/useOpenTaskMarket";
import { useToast } from "@/components/Toast";
import { formatEther } from "viem";

export function OpenTaskMarketDashboard() {
  const { address, isConnected } = useAccount();
  const {
    taskCounter,
    createOpenTask,
    submitBid,
    selectWorker,
    makeCounterOffer,
    acceptCounterOffer,
    rejectCounterOffer,
    withdrawBid,
    isCreating,
    isConfirmingCreate,
    isBidding,
    isSelecting,
    isAccepting,
    isRejecting,
    useWatchOpenTask,
    useWatchBidSubmitted,
    useWatchWorkerSelected,
    useWatchCounterOffer,
  } = useOpenTaskMarket();

  const { addToast } = useToast();

  // State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [myBids, setMyBids] = useState<{ taskId: bigint; bid: Bid }[]>([]);

  // Event watchers (call at top level)
  useWatchOpenTask((taskId) => {
    addToast({ type: "success", title: "New Task Posted", message: `Task #${taskId} is now open for bidding!` });
  });

  useWatchBidSubmitted((taskId, bidder) => {
    if (bidder.toLowerCase() === address?.toLowerCase()) {
      addToast({ type: "info", title: "Bid Placed", message: `Your bid on task #${taskId} was submitted` });
    }
  });

  useWatchWorkerSelected((taskId, worker) => {
    if (worker.toLowerCase() === address?.toLowerCase()) {
      addToast({ type: "success", title: "You Were Selected!", message: `You won task #${taskId}!` });
    }
  });

  useWatchCounterOffer((taskId, bidder) => {
    if (bidder.toLowerCase() === address?.toLowerCase()) {
      addToast({ type: "warning", title: "Counter-Offer Received", message: `Client made counter-offer on task #${taskId}. Check your bids.` });
    }
  });

  const handleCreateTask = async (descriptionHash: string, maxPayment: string, deadline: bigint) => {
    try {
      createOpenTask(maxPayment, deadline, descriptionHash);
      addToast({ type: "info", title: "Posting...", message: "Creating open task on marketplace" });
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not post task" });
    }
  };

  const handleSubmitBid = async (taskId: bigint, price: string, timeEstimate: number, proposal: string) => {
    // In real app, proposal would be uploaded to IPFS first
    const proposalHash = proposal; // placeholder; should be IPFS hash
    try {
      submitBid(taskId, price, timeEstimate, proposalHash);
      addToast({ type: "info", title: "Bidding...", message: "Submitting your bid" });
    } catch (error) {
      addToast({ type: "error", title: "Bid Failed", message: "Could not submit bid" });
    }
  };

  const handleSelectWorker = async (taskId: bigint, worker: string) => {
    try {
      selectWorker(taskId, worker);
      addToast({ type: "info", title: "Selecting...", message: `Selecting ${worker.slice(0, 8)}...` });
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not select worker" });
    }
  };

  // Simple placeholder UI until we wire up full state
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center">
          <h2 className="font-silkscreen text-4xl text-fuchsia-300 mb-4">CONNECT TO ACCESS MARKET</h2>
          <p className="text-white/60">Connect your wallet to view open tasks and place bids.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="font-silkscreen text-5xl text-violet-300 mb-4">OPEN TASK MARKET</h1>
          <p className="text-white/70 text-lg">
            Browse open tasks, place bids, and negotiate with clients.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Open Tasks List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-silkscreen text-2xl text-fuchsia-300">Open Tasks ({taskCounter || 0})</h2>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl shadow-lg hover:from-violet-500 hover:to-fuchsia-500 transition-all"
              >
                {showCreateForm ? "Cancel" : "Post Task"}
              </button>
            </div>

            {showCreateForm && (
              <div className="glass-panel p-6 mb-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
                <h3 className="font-silkscreen text-xl text-violet-300 mb-4">Post New Task</h3>
                {/* Task creation form would go here */}
                <p className="text-white/50">Task creation form coming soon...</p>
              </div>
            )}

            {/* Tasks Grid - Integration Pending */}
            <div className="glass-panel p-8 text-center border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <p className="text-white/60 mb-4">Task marketplace integration in progress.</p>
              <p className="text-white/40 text-sm">Full task listing and bidding functionality will be available soon.</p>
            </div>
          </div>

          {/* Right: My Bids & Activity */}
          <div className="space-y-6">
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">My Bids</h3>
              {myBids.length === 0 ? (
                <p className="text-white/50 text-sm">No active bids</p>
              ) : (
                <div className="space-y-4">
                  {myBids.map(({ taskId, bid }) => (
                    <div key={taskId.toString()} className="bg-black/30 p-4 rounded-xl border border-violet-400/10">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-violet-300 font-semibold">Task #{taskId}</span>
                        <span className="text-fuchsia-300">{formatEther(bid.price)} ETH</span>
                      </div>
                      {bid.hasCounter && !bid.counterAccepted && (
                        <div className="bg-yellow-500/20 border border-yellow-500/40 p-3 rounded-lg mb-3">
                          <p className="text-yellow-300 text-sm mb-2">
                            Counter-offer: {formatEther(bid.counterPrice)} ETH
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => acceptCounterOffer(taskId)}
                              disabled={isAccepting}
                              className="flex-1 py-2 bg-green-600/80 text-white text-sm rounded-lg hover:bg-green-500 disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => rejectCounterOffer(taskId)}
                              disabled={isRejecting}
                              className="flex-1 py-2 bg-red-600/80 text-white text-sm rounded-lg hover:bg-red-500 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      )}
                      <p className="text-white/60 text-xs">
                        Est. {Math.round(bid.timeEstimate / 60)} minutes
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Total Tasks</span>
                  <span className="text-violet-300">{taskCounter || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Your Bids</span>
                  <span className="text-fuchsia-300">{myBids.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
