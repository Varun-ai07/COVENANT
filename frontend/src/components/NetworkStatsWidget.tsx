"use client";

import { useMemo } from "react";
import { formatEther } from "viem";

interface NetworkStatsWidgetProps {
  agentCount: number;
  taskStats: any;
  receiptCount: number;
}

export default function NetworkStatsWidget({
  agentCount,
  taskStats,
  receiptCount
}: NetworkStatsWidgetProps) {
  const stats = useMemo(() => [
    {
      icon: "👥",
      label: "Total Agents",
      value: agentCount,
    },
    {
      icon: "✅",
      label: "Active Tasks",
      value: taskStats.activeTasks,
    },
    {
      icon: "💰",
      label: "Earnings",
      value: `${formatEther(BigInt(taskStats.totalVolumeETH))} ETH`,
    },
    {
      icon: "📊",
      label: "Success Rate",
      value: `${taskStats.successRate}%`,
    },
    {
      icon: "🏆",
      label: "Trust Score",
      value: taskStats.avgReputation,
    },
    {
      icon: "🧾",
      label: "Receipts",
      value: receiptCount,
    },
  ], [agentCount, taskStats, receiptCount]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {stats.map((stat, index) => (
        <div key={index} className="text-center">
          <div className="text-slate-400 text-xs">{stat.label}</div>
          <div className="font-silkscreen text-2xl text-emerald-400 mt-1">
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}