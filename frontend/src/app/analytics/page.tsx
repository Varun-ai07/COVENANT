"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import { useAgent } from "@/hooks/useAgent";
import { useAgentCount, useTaskStats, useReceiptCount } from "@/hooks/useStats";
import { RechartsWrapper } from "@/components/AnalyticsCharts";
import { AgentAnalyticsCard } from "@/components/AgentAnalyticsCard";
import { NetworkStatsWidget } from "@/components/NetworkStatsWidget";

export default function AnalyticsPage() {
  const { address, isConnected } = useAccount();
  const { agent } = useAgent();
  const contracts = isConnected ? getContractAddresses(84532) : getContractAddresses(84532);
  const { agentCount, taskStats, reputationDistribution } = useAgentStats();
  const { receiptCount } = useReceiptCount();
  const [timeRange, setTimeRange] = useState("7d"); // 7d, 30d, all
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-silkscreen text-4xl text-violet-400 mb-6">
            COVENANT ANALYTICS
          </h2>
          <p className="text-white/50 text-lg">
            Please connect your wallet to view analytics
          </p>
        </div>
      </div>
    );
  }

  // Set up auto-refresh interval
  useEffect(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    const interval = setInterval(() => {
      // Trigger refetch by updating timeRange (this will cause hooks to re-run)
      setTimeRange(timeRange);
    }, 30000); // Refresh every 30 seconds
    setRefreshInterval(interval);
    
    return () => clearInterval(interval);
  }, [timeRange]);

  return (
    <div className="min-h-screen bg-black/50">
      {/* Page Header */}
      <div className="p-6">
        <h1 className="font-silkscreen text-3xl text-white mb-4">
          ANALYTICS DASHBOARD
        </h1>
        <p className="text-white/40">
          Network insights and agent performance metrics
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="px-6 py-4 bg-white/5 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-medium text-white/70">
            Time Range:
          </div>
          <div className="flex gap-2">
            {[7, 30, null].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days ? `${days}d` : "all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeRange === (days ? `${days}d` : "all")
                    ? "bg-violet-500/20 text-violet-400"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {days ? `${days}d` : "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 px-6 py-4">
        {/* Network Overview */}
        <div className="col-span-1 md:col-span-2 lg:col-span-3">
          <div className="glass-card p-6">
            <h2 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c4 0 7 2 7 6 0 4-3 9-9 9s-9-5-9-9 3-6 7-6Z" />
              </svg>
              NETWORK OVERVIEW
            </h2>
            <NetworkStatsWidget 
              agentCount={agentCount} 
              taskStats={taskStats} 
              receiptCount={receiptCount} 
            />
          </div>
        </div>

        {/* Agent Performance (if logged in) */}
        {agent && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3">
            <AgentAnalyticsCard agent={agent} timeRange={timeRange} />
          </div>
        )}

        {/* Charts */}
        <div className="col-span-2">
          <div className="glass-card p-6">
            <h2 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12a9 9 0 10-9 9" />
              </svg>
              PERFORMANCE CHARTS
            </h2>
            <RechartsWrapper
              agent={agent}
              timeRange={timeRange}
              taskStats={taskStats}
              reputationDistribution={reputationDistribution}
              receiptCount={receiptCount}
            />
          </div>
        </div>
      </div>
    </div>
  );
}