"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useAgentInsurance, InsurancePool, MemberInfo } from "@/hooks/useAgentInsurance";
import { useTask } from "@/hooks/useTask";
import { useToast } from "@/components/Toast";
import { formatEther, parseEther } from "viem";

export function InsurancePoolDashboard() {
  const { address, isConnected } = useAccount();
  const {
    pool,
    poolLoading,
    memberInfo,
    memberLoading,
    memberAddresses,
    joinPool,
    payPremium,
    claimInsurance,
    withdrawExcess,
    useWatchPremiumPaid,
    useWatchClaimFiled,
    useWatchClaimPaid,
  } = useAgentInsurance();

  const { addToast } = useToast();

  const [claimAmount, setClaimAmount] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("0.0005");

  // Event watchers (top level)
  useWatchPremiumPaid((taskId, member, amount) => {
    if (member.toLowerCase() === address?.toLowerCase()) {
      addToast({ type: "info", title: "Premium Paid", message: `Premium of ${formatEther(amount)} paid for task #${taskId}` });
    }
  });

  useWatchClaimFiled((claimId, claimant, taskId) => {
    if (claimant.toLowerCase() === address?.toLowerCase()) {
      addToast({ type: "warning", title: "Claim Filed", message: `Insurance claim for task #${taskId} submitted` });
    }
  });

  useWatchClaimPaid((claimId, claimant, amount) => {
    if (claimant.toLowerCase() === address?.toLowerCase()) {
      addToast({ type: "success", title: "Claim Paid", message: `Received ${formatEther(amount)} from insurance pool` });
    }
  });

  const handleJoinPool = async (contribution: string) => {
    try {
      joinPool(contribution);
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not join pool" });
    }
  };

  const handlePayPremium = async (taskId: bigint, amount: string) => {
    try {
      payPremium(taskId, amount);
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not pay premium" });
    }
  };

  const handleClaim = async (taskId: bigint) => {
    try {
      claimInsurance(taskId);
    } catch (error) {
      addToast({ type: "error", title: "Failed", message: "Could not file claim" });
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
        <div className="text-center">
          <h2 className="font-silkscreen text-4xl text-fuchsia-300 mb-4">CONNECT TO ACCESS INSURANCE</h2>
          <p className="text-white/60">Connect your wallet to view and manage insurance pool.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="font-silkscreen text-5xl text-violet-300 mb-4">AGENT INSURANCE POOL</h1>
          <p className="text-white/70 text-lg">
            Protect your tasks with insurance. Join the pool, pay premiums, and claim on failure.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pool Overview */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-panel p-8 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h2 className="font-silkscreen text-2xl text-fuchsia-300 mb-6">Pool Overview</h2>

              {poolLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-violet-900/30 rounded"></div>
                  <div className="h-8 bg-violet-900/30 rounded"></div>
                  <div className="h-8 bg-violet-900/30 rounded"></div>
                </div>
              ) : pool ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-white/60 text-sm mb-1">Total Pool</div>
                    <div className="font-mono text-2xl text-violet-300">{formatEther(pool.totalPool)} ETH</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm mb-1">Premiums Paid</div>
                    <div className="font-mono text-2xl text-fuchsia-300">{formatEther(pool.totalPremiumsPaid)} ETH</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm mb-1">Claims Paid</div>
                    <div className="font-mono text-2xl text-blue-300">{formatEther(pool.totalClaimsPaid)} ETH</div>
                  </div>
                  <div>
                    <div className="text-white/60 text-sm mb-1">Reserve Ratio</div>
                    <div className="font-mono text-2xl text-green-300">{(pool.reserveRatio * 100).toFixed(1)}%</div>
                  </div>
                </div>
              ) : (
                <p className="text-white/50">Pool data unavailable</p>
              )}
            </div>

            {/* My Membership */}
            <div className="glass-panel p-8 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h2 className="font-silkscreen text-2xl text-fuchsia-300 mb-6">My Membership</h2>

              {memberLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-violet-900/30 rounded"></div>
                  <div className="h-8 bg-violet-900/30 rounded"></div>
                </div>
              ) : memberInfo ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-black/30 rounded-xl border border-violet-400/20">
                    <div>
                      <div className="text-white/60 text-sm">Status</div>
                      <div className={`font-semibold ${memberInfo.isMember ? 'text-green-300' : 'text-yellow-300'}`}>
                        {memberInfo.isMember ? 'Active Member' : 'Not a Member'}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/60 text-sm">Contribution</div>
                      <div className="font-mono text-violet-300">{formatEther(memberInfo.contribution)} ETH</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 p-4 rounded-xl">
                      <div className="text-white/60 text-sm mb-1">Active Tasks</div>
                      <div className="text-2xl text-fuchsia-300">{memberInfo.activeTasks.toString()}</div>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl">
                      <div className="text-white/60 text-sm mb-1">Premiums Paid</div>
                      <div className="text-2xl text-blue-300">{formatEther(memberInfo.totalPaidPremiums)} ETH</div>
                    </div>
                    <div className="bg-black/30 p-4 rounded-xl">
                      <div className="text-white/60 text-sm mb-1">Claims Received</div>
                      <div className="text-2xl text-green-300">{formatEther(memberInfo.totalReceivedClaims)} ETH</div>
                    </div>
                  </div>

                  {memberInfo.isMember && (
                    <button
                      onClick={() => withdrawExcess("0")}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-fuchsia-500 transition-all"
                    >
                      Withdraw Excess Funds
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-white/60">Join the insurance pool to protect your tasks.</p>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      placeholder="Contribution (ETH)"
                      value={premiumAmount}
                      onChange={(e) => setPremiumAmount(e.target.value)}
                      className="flex-1 bg-black/30 border border-violet-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-400"
                    />
                    <button
                      onClick={() => handleJoinPool(premiumAmount)}
                      className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 text-white font-semibold rounded-xl hover:from-green-500 hover:to-teal-500 transition-all"
                    >
                      Join Pool
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Stats */}
          <div className="space-y-6">
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl sticky top-8">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">Quick Actions</h3>

              {memberInfo?.isMember && (
                <div className="space-y-4">
                  <div>
                    <label className="text-white/70 text-sm mb-2 block">Pay Premium for Task ID</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Task ID"
                        className="flex-1 bg-black/30 border border-violet-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-400"
                      />
                      <input
                        type="text"
                        placeholder="Amount (ETH)"
                        value={premiumAmount}
                        onChange={(e) => setPremiumAmount(e.target.value)}
                        className="w-24 bg-black/30 border border-violet-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-400"
                      />
                    </div>
                    <button className="w-full mt-2 py-2 bg-violet-600/80 text-white text-sm rounded-lg hover:bg-violet-500 transition-all">
                      Pay Premium
                    </button>
                  </div>

                  <div>
                    <label className="text-white/70 text-sm mb-2 block">File Claim (Task ID)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Task ID"
                        className="flex-1 bg-black/30 border border-violet-500/30 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-violet-400"
                      />
                      <button className="px-4 py-2 bg-red-600/80 text-white text-sm rounded-lg hover:bg-red-500 transition-all">
                        Claim
                      </button>
                    </div>
                    <p className="text-white/50 text-xs mt-2">
                      File a claim if your task failed and you paid premiums.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Pool Members */}
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">Pool Members</h3>
              <div className="text-3xl font-mono text-violet-300">{memberAddresses.length}</div>
              <p className="text-white/60 text-sm mt-2">Total participants</p>
            </div>

            {/* Governance */}
            <div className="glass-panel p-6 border border-violet-500/20 bg-black/20 backdrop-blur-xl rounded-2xl">
              <h3 className="font-silkscreen text-xl text-fuchsia-300 mb-4">Governance</h3>
              <p className="text-white/60 text-sm mb-4">
                Members can vote on claim approvals and pool parameter changes.
              </p>
              <button className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-500 transition-all">
                View Governance Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
