"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import RechartsWrapper from "@/components/RechartsWrapper";

interface AnalyticsChartsProps {
  agent: any; // Would be Agent type from types
  timeRange: string; // "7d", "30d", "all"
  taskStats: any; // TaskStats type
  reputationDistribution: any; // ReputationDistribution type
  receiptCount: number;
}

export default function AnalyticsCharts({
  agent,
  timeRange,
  taskStats,
  reputationDistribution,
  receiptCount
}: AnalyticsChartsProps) {
  // In a real implementation, this would fetch historical data from subgraphs or APIs
  // For now, we'll use mock data that reflects current state
  
  // Generate mock historical data based on time range
  const getMockData = () => {
    const now = Date.now();
    const dataPoints = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const data = [];
    
    for (let i = 0; i < dataPoints; i++) {
      const date = new Date(now - (dataPoints - i - 1) * 24 * 60 * 60 * 1000);
      // Simulate some variance in the data
      const variance = 1 + (Math.random() - 0.5) * 0.2; // ±10% variance
      data.push({
        date: date.toISOString().split('T')[0],
        tasks: Math.round((taskStats.activeTasks || 0) * variance),
        volume: Math.round((taskStats.totalVolumeETH || 0) * variance * 100) / 100,
        reputation: Math.round((taskStats.avgReputation || 0) * variance),
      });
    }
    
    return data;
  };
  
  const chartData = getMockData();
  
  return (
    <div className="space-y-6">
      {/* Tasks Over Time */}
      <div className="glass-card p-6">
        <h3 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c4 0 7 2 7 6 0 4-3 9-9 9s-9-5-9-9 3-6 7-6Z" />
          </svg>
          ACTIVE TASKS OVER TIME
        </h3>
        <RechartsWrapper 
          data={chartData}
          xKey="date"
          yKey="tasks"
          title="Active Tasks"
          unit="tasks"
          chartType="line"
        />
      </div>
      
      {/* Volume Over Time */}
      <div className="glass-card p-6">
        <h3 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          TRANSACTION VOLUME OVER TIME
        </h3>
        <RechartsWrapper 
          data={chartData}
          xKey="date"
          yKey="volume"
          title="Transaction Volume"
          unit="ETH"
          chartType="area"
        />
      </div>
      
      {/* Reputation Distribution */}
      <div className="glass-card p-6">
        <h3 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          REPUTATION DISTRIBUTION
        </h3>
        <RechartsWrapper 
          data={reputationDistribution.map((item: any, index: number) => ({
            range: item.range,
            count: item.count,
            color: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][index] || '#6b7280'
          }))}
          xKey="range"
          yKey="count"
          title="Reputation Distribution"
          unit="agents"
          chartType="bar"
        />
      </div>
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tasks */}
        <div className="glass-card p-6">
          <h3 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            RECENT TASKS
          </h3>
          <div className="space-y-3">
            {/* Mock recent tasks data */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-xl">
                <div className="flex-1">
                  <p className="text-white font-medium">Task #{100 + i}</p>
                  <p className="text-slate-400 text-sm">
                    Completed {new Date(Date.now() - i * 2 * 60 * 60 * 1000).toLocaleTimeString()}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                  i % 2 === 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
                }`}>
                  {i % 2 === 0 ? "Success" : "Failed"}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Network Health */}
        <div className="glass-card p-6">
          <h3 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22s8-4 8-10V5l-8-3-8 3h7" />
            </svg>
            NETWORK HEALTH
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Success Rate</span>
              <span className="font-silkscreen text-lg">
                {taskStats.successRate || 0}%
              </span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-3">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full"
                style={{ width: `${taskStats.successRate || 0}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Avg. Reputation</span>
              <span className="font-silkscreen text-lg">
                {taskStats.avgReputation || 0}
              </span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-3">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full"
                style={{ width: `${Math.min((taskStats.avgReputation || 0) / 10, 100)}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Daily Volume</span>
              <span className="font-silkscreen text-lg">
                {(taskStats.totalVolumeETH || 0).toFixed(2)} ETH
              </span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-3">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-300 rounded-full"
                style={{ width: `${Math.min((taskStats.totalVolumeETH || 0) * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}