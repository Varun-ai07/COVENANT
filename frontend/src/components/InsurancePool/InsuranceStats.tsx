"use client";

import { useState } from "react";
import { formatEther } from "viem";

interface InsuranceStatsProps {
  poolBalance: number;
  memberCount: number;
  claimCount: number;
  isMember: boolean;
  onJoinPool: () => void;
}

export default function InsuranceStats({
  poolBalance,
  memberCount,
  claimCount,
  isMember,
  onJoinPool
}: InsuranceStatsProps) {
  return (
    <div className="glass-card p-6">
      <h2 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c4 0 7 2 7 6 0 4-3 9-9 9s-9-5-9-9 3-6 7-6Z" />
        </svg>
        POOL STATISTICS
      </h2>
      <div className="grid gap-4">
        <div className="bg-black/20 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Pool Balance</p>
          <p className="font-silkscreen text-2xl text-green-400">
            {poolBalance.toFixed(4)} ETH
          </p>
        </div>
        <div className="bg-black/20 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Total Members</p>
          <p className="font-silkscreen text-2xl text-blue-400">
            {memberCount}
          </p>
        </div>
        <div className="bg-black/20 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Claims Paid</p>
          <p className="font-silkscreen text-2xl text-emerald-400">
            {claimCount}
          </p>
        </div>
        <div className="bg-black/20 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Avg. Claim Size</p>
          <p className="font-silkscreen text-2xl text-purple-400">
            {(poolBalance / Math.max(memberCount, 1)).toFixed(4)} ETH
          </p>
        </div>
      </div>
      
      {!isMember && (
        <div className="mt-4">
          <button
            onClick={onJoinPool}
            className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-glow-emerald transition-all duration-300 font-silkscreen text-xs tracking-[0.1em]"
          >
            JOIN INSURANCE POOL
          </button>
        </div>
      )}
    </div>
  );
}