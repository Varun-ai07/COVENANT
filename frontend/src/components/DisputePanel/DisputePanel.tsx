"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDisputeArbitration, Dispute } from "@/hooks/useDisputeArbitration";
import { useTask } from "@/hooks/useTask";
import { useToast } from "@/components/Toast";
import { formatEther } from "viem";

const STATUS_LABELS: Record<number, string> = {
  0: "Active",
  1: "Resolved",
};

export function DisputePanel() {
  const { address, isConnected } = useAccount();
  const {
    disputeCounter,
    useDispute,
    useMyDisputes,
    castVote,
    withdrawBond,
    useWatchDisputeCreated,
    useWatchVoteCast,
    useWatchDisputeResolved,
    isVoting,
    isWithdrawing,
  } = useDisputeArbitration();

  const { addToast } = useToast();

  const [selectedDisputeId, setSelectedDisputeId] = useState<bigint | null>(null);

  // Load my dispute IDs
  const { disputeIds: myDisputeIds } = useMyDisputes(address);

  // Event watchers (top level)
  useWatchDisputeCreated((disputeId) => {
    addToast({ type: "warning", title: "New Dispute", message: `Dispute #${disputeId} filed` });
  });

  useWatchVoteCast((disputeId, juror) => {
    if (juror.toLowerCase() === address?.toLowerCase()) {
      addToast({ type: "info", title: "Vote Recorded", message: `Your vote on dispute #${disputeId} counted` });
    }
  });

  useWatchDisputeResolved((disputeId, winner) => {
    addToast({ type: "success", title: "Dispute Resolved", message: `Dispute #${disputeId} - Winner: ${winner.slice(0, 8)}...` });
  });

  // Fetch selected dispute details
  const { dispute: selectedDispute } = useDispute(selectedDisputeId ?? undefined);

  const handleVote = async (disputeId: bigint, voteForChallenger: boolean) => {
    try {
      castVote(disputeId, voteForChallenger);
      addToast({ type: "info", title: "Voting...", message: voteForChallenger ? "Voting for challenger" : "Voting for worker" });
    } catch (error) {
      addToast({ type: "error", title: "Vote Failed", message: "Could not cast vote" });
    }
  };

  const handleWithdrawBond = async (disputeId: bigint) => {
    try {
      withdrawBond(disputeId);
      addToast({ type: "info", title: "Withdrawing...", message: "Withdrawing dispute bond" });
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not withdraw bond" });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center">
          <h2 className="font-silkscreen text-4xl text-fuchsia-300 mb-4">CONNECT TO ACCESS DISPUTES</h2>
          <p className="text-white/60">Connect your wallet to view and participate in disputes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="font-silkscreen text-5xl text-violet-300 mb-4">DISPUTE ARBITRATION</h1>
          <p className="text-white/70 text-lg">
            Resolve task disagreements through decentralized jury voting.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Disputes List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-silkscreen text-2xl text-fuchsia-300">
                Disputes ({myDisputeIds.length})
              </h2>
            </div>

            <div className="space-y-4">
              {myDisputeIds.length === 0 ? (
                <div className="glass-panel p-8 text-center border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
                  <p className="text-white/60">No disputes involving you.</p>
                </div>
              ) : (
                myDisputeIds.map((disputeId) => (
                  <div
                    key={disputeId.toString()}
                    className={`glass-panel p-6 border ${selectedDisputeId === disputeId ? 'border-violet-400/60' : 'border-violet-500/20'} bg-black/20 backdrop-blur-xl rounded-2xl cursor-pointer hover:border-violet-400/40 transition-all`}
                    onClick={() => setSelectedDisputeId(disputeId)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-silkscreen text-violet-300">Dispute #{disputeId.toString()}</span>
                      <span className="px-3 py-1 rounded-full text-sm bg-yellow-500/20 text-yellow-300">
                        Loading...
                      </span>
                    </div>
                    <p className="text-white/50 text-sm mt-2">Click to load details</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dispute Details */}
          <div className="space-y-6">
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl sticky top-8">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">
                {selectedDispute ? `Dispute #${selectedDispute.disputeId}` : 'Select a Dispute'}
              </h3>

              {selectedDispute ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-white/60">Status</span>
                      <span className={`${selectedDispute.status === 0 ? 'text-red-300' : 'text-green-300'}`}>
                        {STATUS_LABELS[selectedDispute.status]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Votes (Challenger)</span>
                      <span className="text-fuchsia-300">{selectedDispute.votesForChallenger}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Votes (Worker)</span>
                      <span className="text-violet-300">{selectedDispute.votesForWorker}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Jurors Voted</span>
                      <span className="text-white">{selectedDispute.jurorsVoted}</span>
                    </div>
                  </div>

                  {selectedDispute.status === 0 && (
                    <>
                      <div className="pt-4 border-t border-violet-500/20">
                        <h4 className="text-fuchsia-300 font-semibold mb-3">Cast Your Vote</h4>
                        <div className="space-y-3">
                          <button
                            onClick={() => handleVote(selectedDispute.disputeId, true)}
                            disabled={isVoting}
                            className="w-full py-3 bg-red-600/80 text-white font-semibold rounded-xl hover:bg-red-500 disabled:opacity-50 transition-all"
                          >
                            {isVoting ? "Voting..." : "Vote for Challenger"}
                          </button>
                          <button
                            onClick={() => handleVote(selectedDispute.disputeId, false)}
                            disabled={isVoting}
                            className="w-full py-3 bg-blue-600/80 text-white font-semibold rounded-xl hover:bg-blue-500 disabled:opacity-50 transition-all"
                          >
                            {isVoting ? "Voting..." : "Vote for Worker"}
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-violet-500/20">
                        <p className="text-white/60 text-sm mb-3">
                          As a juror, you staked ETH to participate. If you vote with the majority, you earn rewards. If not, you lose your stake.
                        </p>
                      </div>
                    </>
                  )}

                  {selectedDispute.status === 1 && selectedDispute.challenger.toLowerCase() === address?.toLowerCase() && (
                    <div className="pt-4 border-t border-violet-500/20">
                      <button
                        onClick={() => handleWithdrawBond(selectedDispute.disputeId)}
                        disabled={isWithdrawing}
                        className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 transition-all"
                      >
                        {isWithdrawing ? "Withdrawing..." : "Withdraw Bond"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-white/50 text-sm">Select a dispute to view details</p>
              )}
            </div>

            {/* Global Stats */}
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">Arbitration Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Total Disputes</span>
                  <span className="text-violet-300">{disputeCounter || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Your Disputes</span>
                  <span className="text-fuchsia-300">{myDisputeIds.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
