"use client";

import { formatEther } from "viem";
import { Agent, getReputationLevel, formatAddress } from "@/types";

interface AgentCardProps {
  agent: Agent;
  address: string;
  rank?: number;
  compact?: boolean;
}

export function AgentCard({ agent, address, rank, compact = false }: AgentCardProps) {
  const reputationLevel = getReputationLevel(Number(agent.reputation));

  if (compact) {
    return (
      <div className="glass-card p-4 group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {rank !== undefined && (
              <span className={`text-2xl font-bold ${rank <= 3 ? "text-violet-400" : "text-slate-600"}`}>
                #{rank}
              </span>
            )}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-sm opacity-30 group-hover:opacity-50 transition-opacity" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
                <span className="text-violet-400 font-bold text-sm">{agent.name?.[0]?.toUpperCase()}</span>
              </div>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{agent.name}</p>
              <p className="text-slate-500 text-xs font-mono">{formatAddress(address)}</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${reputationLevel.color}`}>
              {agent.reputation.toString()}
            </div>
            <p className="text-slate-600 text-xs">{reputationLevel.label}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card card-inner-glow p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          {rank !== undefined && (
            <span className={`text-3xl font-bold ${rank <= 3 ? "text-violet-400" : "text-slate-600"}`}>
              #{rank}
            </span>
          )}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur-md opacity-30" />
            <div className="relative w-14 h-14 bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center">
              <span className="text-violet-400 font-bold text-xl">{agent.name?.[0]?.toUpperCase()}</span>
            </div>
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{agent.name}</p>
            <p className="text-slate-500 text-sm font-mono">{formatAddress(address, 6)}</p>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${reputationLevel.bgColor}/10 ${reputationLevel.color} border ${reputationLevel.bgColor}/20`}>
          {reputationLevel.label}
        </span>
      </div>

      {/* Reputation Bar */}
      <div className="mb-5">
        <div className="flex justify-between mb-2">
          <span className="text-slate-400 text-sm">Reputation</span>
          <span className="text-white font-semibold text-sm">{agent.reputation.toString()}/1000</span>
        </div>
        <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${reputationLevel.bgColor}`}
            style={{ width: `${(Number(agent.reputation) / 1000) * 100}%` }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Staked</p>
          <p className="text-white font-semibold text-sm">{formatEther(agent.stakedAmount)} ETH</p>
        </div>
        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Tasks Done</p>
          <p className="text-white font-semibold text-sm">{agent.tasksCompleted.toString()}</p>
        </div>
        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Tasks Failed</p>
          <p className="text-red-400 font-semibold text-sm">{agent.tasksFailed.toString()}</p>
        </div>
        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Total Value</p>
          <p className="text-white font-semibold text-sm">{formatEther(agent.totalValueTransferred)} ETH</p>
        </div>
      </div>

      {/* Capabilities */}
      <div className="mb-5">
        <p className="text-slate-500 text-xs mb-2">Capabilities</p>
        <div className="flex flex-wrap gap-2">
          {agent.capabilities?.map((cap, i) => (
            <span
              key={i}
              className="px-2.5 py-1 bg-violet-500/10 text-violet-300 text-xs rounded-lg border border-violet-500/20"
            >
              {cap}
            </span>
          ))}
        </div>
      </div>

      {/* DID */}
      <div className="bg-black/20 rounded-xl p-3 border border-white/5">
        <p className="text-slate-500 text-xs mb-1">DID (ERC-8004)</p>
        <p className="text-slate-400 text-xs font-mono truncate">{agent.did}</p>
      </div>
    </div>
  );
}
