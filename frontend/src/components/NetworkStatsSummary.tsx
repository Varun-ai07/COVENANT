"use client";

interface NetworkStatsSummaryProps {
  agentCount: number;
  taskCount: number;
  receiptCount: number;
  networkStats: any;
  lastUpdate: number;
}

export default function NetworkStatsSummary({ 
  agentCount, 
  taskCount, 
  receiptCount, 
  networkStats,
  lastUpdate
}: NetworkStatsSummaryProps) {
  const timeAgo = lastUpdate > 0 ? 
    `${Math.floor((Date.now() - lastUpdate) / 1000)}s ago` : 
    "never";

  return (
    <div className="grid gap-4 px-4 py-3">
      <div className="col-span-1 md:col-span-3 lg:col-span-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm font-medium text-white/70">
            Network Statistics:
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-slate-400 text-xs">Agents</div>
              <div className="font-silkscreen text-2xl text-emerald-400">
                {agentCount}
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">Tasks</div>
              <div className="font-silkscreen text-2xl text-fuchsia-400">
                {taskCount}
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">Receipts</div>
              <div className="font-silkscreen text-2xl text-blue-400">
                {receiptCount}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {networkStats && (
        <div className="col-span-1 md:col-span-3 lg:col-span-4">
          <div className="glass-card p-4">
            <h3 className="font-silkscreen text-lg text-white mb-3">
              NETWORK HEALTH
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Average Task Completion Time</span>
                <span className="font-mono">
                  {networkStats.avgCompletionTime?.toFixed(1) || "0"} min
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Network Uptime</span>
                <span className="font-mono">
                  {networkStats.uptimePercentage?.toFixed(1) || "0"}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Gas Price Average</span>
                <span className="font-mono">
                  {networkStats.avgGasPrice?.toFixed(0) || "0"} gwei
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Last Updated</span>
                <span className="text-slate-400 text-xs">
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}