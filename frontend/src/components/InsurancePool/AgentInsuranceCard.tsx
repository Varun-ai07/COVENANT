"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { Agent } from "@/types";

interface AgentInsuranceCardProps {
  agent: Agent | null;
  isMember: boolean;
  memberInfo: {
    totalPremiumsPaid: number;
    totalClaimsReceived: number;
  };
  onPayPremium: (taskId: string) => void;
  showDetails?: boolean;
}

export default function AgentInsuranceCard({
  agent,
  isMember,
  memberInfo,
  onPayPremium,
  showDetails = false
}: AgentInsuranceCardProps) {
  const [activeTasks, setActiveTasks] = useState(0);

  // In a real implementation, this would fetch from blockchain or API
  // For now, we'll simulate some data
  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="font-silkscreen text-lg text-white mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3h7" />
            </svg>
            AGENT INSURANCE STATUS
          </h2>
        </div>
        {!showDetails && (
          <button
            onClick={() => {}}
            className="text-xs text-slate-400 hover:text-white underline"
          >
            View Details
          </button>
        )}
      </div>

      {agent ? (
        <>
          <div className="space-y-4">
            {/* Membership Status */}
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
              <div className="flex-1">
                <p className="text-slate-400 text-sm">Membership Status</p>
                <p className={`font-semibold text-sm ${isMember ? "text-emerald-400" : "text-red-400"}`}>
                  {isMember ? "Active Member" : "Not a Member"}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-md text-xs font-medium ${isMember ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                {isMember ? "IN" : "OUT"}
              </span>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">Total Premiums Paid</p>
                <p className="font-silkscreen text-lg text-blue-400">
                  {memberInfo.totalPremiumsPaid.toFixed(4)} ETH
                </p>
              </div>
              <div className="bg-black/20 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">Claims Received</p>
                <p className="font-silkscreen text-lg text-emerald-400">
                  {memberInfo.totalClaimsReceived.toFixed(4)} ETH
                </p>
              </div>
            </div>

            {/* Agent Stats */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">Current Reputation</span>
                <span className="font-silkscreen text-lg">
                  {agent.reputation}
                </span>
              </div>
              <div className="w-full bg-black/20 rounded-full h-2.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    agent.reputation >= 800
                      ? "bg-emerald-500"
                      : agent.reputation >= 600
                      ? "bg-blue-500"
                      : agent.reputation >= 400
                      ? "bg-amber-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${(agent.reputation / 1000) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-400 text-xs">Active Tasks</span>
                <span className="font-silkscreen text-lg">{activeTasks}</span>
              </div>
            </div>

            {/* Action Buttons */}
            {isMember && agent && (
              <div className="mt-4 space-y-3">
                <button
                  onClick={() => onPayPremium("123")} // Would pass actual task ID
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 font-silkscreen text-xs tracking-[0.1em]"
                >
                  Pay Premium for Active Task
                </button>
                
                <button
                  onClick={() => {}}
                  className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-glow-red transition-all duration-300 font-silkscreen text-xs tracking-[0.1em]"
                >
                  File Insurance Claim
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-slate-400">Loading agent data...</p>
        </div>
      )}
    </div>
  );
}