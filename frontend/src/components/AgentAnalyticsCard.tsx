"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { Agent } from "@/types";

interface AgentAnalyticsCardProps {
  agent: Agent;
  timeRange: string; // "7d", "30d", "all"
}

export default function AgentAnalyticsCard({ agent, timeRange }: AgentAnalyticsCardProps) {
  const [stats, setStats] = useState({
    tasksCompleted: 0,
    tasksFailed: 0,
    successRate: 0,
    avgRating: 0,
    totalEarned: 0,
    reputationChange: 0,
  });

  useEffect(() => {
    // In a real implementation, this would fetch from backend APIs or subgraphs
    // For now, we'll simulate with agent data
    setStats({
      tasksCompleted: agent.tasksCompleted,
      tasksFailed: agent.tasksFailed,
      successRate: agent.tasksCompleted > 0 
        ? Math.round((agent.tasksCompleted / (agent.tasksCompleted + agent.tasksFailed)) * 100)
        : 0,
      avgRating: 4.5, // Would come from reputation/verification data
      totalEarned: Number(formatEther(BigInt(agent.totalValueTransferred))),
      reputationChange: agent.reputation - 500, // Change from initial reputation
    });
  }, [agent, timeRange]);

  if (!agent) {
    return <div className="glass-card p-6">Loading agent data...</div>;
  }

  return (
    <div className="glass-card p-6">
      <h2 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18h6" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v6" />
        </svg>
        PERFORMANCE METRICS
      </h2>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-slate-400 text-xs">Tasks Completed</div>
            <div className="font-silkscreen text-2xl text-emerald-400">
              {stats.tasksCompleted}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs">Tasks Failed</div>
            <div className="font-silkscreen text-2xl text-red-400">
              {stats.tasksFailed}
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs">Success Rate</div>
            <div className="font-silkscreen text-2xl">
              {stats.successRate}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs">Avg. Rating</div>
            <div className="font-silkscreen text-2xl text-yellow-400">
              {stats.avgRating}/5.0
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs">Total Earned</div>
            <div className="font-silkscreen text-2xl text-green-400">
              {stats.totalEarned.toFixed(4)} ETH
            </div>
          </div>
          <div className="text-center">
            <div className="text-slate-400 text-xs">Reputation Δ</div>
            <div className={`font-silkscreen text-2xl ${stats.reputationChange >= 0 ? "text-green-400" : "text-red-400"}`}>
              {stats.reputationChange >= 0 ? '+' : ''}{stats.reputationChange}
            </div>
          </div>
        </div>
        
        {/* Progress bars */}
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Reputation Progress</span>
              <span className="font-silkscreen text-[10px]">
                {agent.reputation}/1000
              </span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
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
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Task Completion Trend</span>
              <span className="font-silkscreen text-[10px]">
                {stats.successRate}%
              </span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 bg-blue-500`}
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}