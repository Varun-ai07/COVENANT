"use client";

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
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div className="text-center">
        <div className="text-slate-400 text-xs">Total Agents</div>
        <div className="font-silkscreen text-2xl text-emerald-400">
          {agentCount}
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-400 text-xs">Active Tasks</div>
        <div className="font-silkscreen text-2xl text-fuchsia-400">
          {taskStats.activeTasks}
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-400 text-xs">Completed Today</div>
        <div className="font-silkscreen text-2xl text-green-400">
          {taskStats.completedToday}
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-400 text-xs">Volume (ETH)</div>
        <div className="font-silkscreen text-2xl text-blue-400">
          {formatEther(BigInt(taskStats.totalVolumeETH))}
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-400 text-xs">Success Rate</div>
        <div className="font-silkscreen text-2xl">
          {taskStats.successRate}%
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-400 text-xs">Avg. Reputation</div>
        <div className="font-silkscreen text-2xl text-amber-400">
          {taskStats.avgReputation}
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-400 text-xs">Receipts</div>
        <div className="font-silkscreen text-2xl text-blue-400">
          {receiptCount}
        </div>
      </div>
    </div>
  );
}