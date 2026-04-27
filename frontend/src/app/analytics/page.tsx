"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { ResourcePreloader, MemoryManager } from "@/lib/performance-optimizations";

// Initialize performance managers
const preloader = ResourcePreloader.getInstance();
const memoryManager = MemoryManager.getInstance();

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [agentData, setAgentData] = useState<any>(null);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [reputationDist, setReputationDist] = useState<any>(null);

  // Use React Query for chart data
  const chartData = useMemo(() => {
    return {
      agentActivity: [
        { label: "Jan", value: 45 },
        { label: "Feb", value: 67 },
        { label: "Mar", value: 89 },
        { label: "Apr", value: 123 },
        { label: "May", value: 156 },
        { label: "Jun", value: 189 }
      ],
      taskCompletion: [
        { label: "Success", value: 89 },
        { label: "Failed", value: 11 }
      ],
      reputationBuckets: [
        { label: "0-500", value: 45 },
        { label: "501-1000", value: 156 },
        { label: "1001+", value: 78 }
      ]
    };
  }, []);

  const generateMockData = useCallback(() => {
    return {
      totalAgents: 23,
      activeAgents: 18,
      avgReputation: 742,
      totalVolume: "142.5 ETH",
      completionRate: "92.3%"
    };
  }, []);

  const generateTaskStats = useCallback(() => {
    return {
      total: 1247,
      completed: 892,
      pending: 234,
      failed: 121,
      avgCompletionTime: "4.2h"
    };
  }, []);

  const generateReputationData = useCallback(() => {
    return [
      { level: "Bronze", count: 45, color: "#f59e0b" },
      { level: "Silver", count: 156, color: "#c0c0c0" },
      { level: "Gold", count: 78, color: "#ffd700" },
      { level: "Platinum", count: 34, color: "#e5e7eb" },
      { level: "Diamond", count: 12, color: "#06b6d4" }
    ];
  }, []);

  useEffect(() => {
    preloader.preloadCriticalResources();

    // Set up auto-refresh
    const interval = setInterval(() => {
      setAgentData(generateMockData());
      setTaskStats(generateTaskStats());
      setReputationDist(generateReputationData());
    }, 30000); // Refresh every 30 seconds

    setRefreshInterval(interval);

    // Initial data load
    setAgentData(generateMockData());
    setTaskStats(generateTaskStats());
    setReputationDist(generateReputationData());

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      memoryManager.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black/50">
      {/* Header */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="font-silkscreen text-3xl text-white mb-2">
            ANALYTICS DASHBOARD
          </h1>
          <p className="text-white/40 text-sm font-silkscreen tracking-[0.1em]">
            Network insights and agent performance metrics
          </p>
        </div>
      </div>

      {/* Time Controls */}
      <div className="max-w-7xl mx-auto px-6 pb-4">
        <div className="flex gap-2">
          {["1d", "7d", "30d", "all"].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                timeRange === range
                  ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                  : "bg-white/5 hover:bg-white/10"
              }`}
            >
              {range === "all" ? "All Time" : range}
            </button>
          ))}
          <button
            onClick={() => {
              if (refreshInterval) {
                clearInterval(refreshInterval);
                setRefreshInterval(null);
              }
            }}
            className="ml-auto text-sm text-slate-400 hover:text-white"
          >
            {refreshInterval ? "Auto-refresh: ON" : "Auto-refresh: OFF"}
          </button>
        </div>
      </div>

      {/* Network Overview */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: "Total Agents", value: agentData?.totalAgents || 0, color: "text-emerald-400" },
            { label: "Active Agents", value: agentData?.activeAgents || 0, color: "text-blue-400" },
            { label: "Avg Reputation", value: agentData?.avgReputation || 0, color: "text-amber-400" },
            { label: "Total Volume", value: agentData?.totalVolume || "0 ETH", color: "text-purple-400" }
          ].map((metric, index) => (
            <div key={metric.label} className="glass-card p-6 text-center">
              <div className={`text-3xl mb-2 ${metric.color}`}>
                {metric.label === "Avg Reputation" ? "⭐" : metric.label === "Total Volume" ? "💰" : metric.label === "Active Agents" ? "👥" : "📊"}
              </div>
              <div className="font-silkscreen text-2xl font-bold">{metric.value}</div>
              <div className="text-xs text-slate-500 mt-1">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Task Completion Chart */}
          <div className="glass-card p-6">
            <h2 className="font-silkscreen text-lg mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20l9-2-9-2-9 2 9 2zm0-10l9 2-9 2-9-2 9-2z" />
              </svg>
              TASK COMPLETION
            </h2>
            <div className="space-y-3">
              {chartData.taskCompletion.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm w-20 font-mono">{item.label}</span>
                  <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${(item.value / 100) * 100}%` }} />
                  </div>
                  <span className="text-sm text-slate-400 w-12 text-right">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reputation Distribution */}
          <div className="glass-card p-6">
            <h2 className="font-silkscreen text-lg mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              REPUTATION DISTRIBUTION
            </h2>
            <div className="space-y-2">
              {(reputationDist || []).map((bucket: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm w-20 font-mono">{bucket.level}</span>
                  <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                    <div className="bg-amber-400 h-2 rounded-full" style={{ width: `${(bucket.count / 400) * 100}%` }} />
                  </div>
                  <span className="text-sm text-slate-400 w-12 text-right">{bucket.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="glass-card p-6">
            <h2 className="font-silkscreen text-lg mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              PERFORMANCE
            </h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm font-mono">Completion Rate</span>
                <span className="text-green-400 font-semibold">92.3%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm font-mono">Avg Response</span>
                <span className="text-blue-400 font-semibold">4.2h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm font-mono">Success Rate</span>
                <span className="text-emerald-400 font-semibold">89%</span>
              </div>
              <div className="w-full bg-slate-700/50 rounded-full h-2 mt-4">
                <div className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full" style={{ width: '89%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
