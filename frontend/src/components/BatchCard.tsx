"use client";

interface BatchCardProps {
  batch: {
    id: bigint;
    client: string;
    totalPayment: bigint;
    taskIds: bigint[];
    status: number; // 0 = Open, 1 = In Progress, 2 = Completed, 3 = Failed
    postedAt: bigint;
  };
  contracts: any; // Would be from getContractAddresses
}

export default function BatchCard({ batch, contracts }: BatchCardProps) {
  const statusLabels = ["Open", "In Progress", "Completed", "Failed"];
  const statusColors = ["text-yellow-400", "text-blue-400", "text-green-400", "text-red-400"];
  
  return (
    <div className="glass-card p-4 hover:shadow-lg transition-shadow duration-200">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-silkscreen text-lg text-white mb-1">
            BATCH #{batch.id.toString().slice(0, 6)}...{batch.id.toString().slice(-4)}
          </h3>
          <p className="text-slate-400 text-xs">
            Created: {new Date(Number(batch.postedAt) * 1000).toLocaleString()}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[batch.status]}`}>
          {statusLabels[batch.status]}
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span>Total Payment:</span>
          <span className="font-mono">{batch.totalPayment.toString()} wei</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Task Count:</span>
          <span className="font-mono">{batch.taskIds.length}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Client:</span>
          <span className="font-mono truncate max-w-xs">
            {batch.client.slice(0, 6)}...{batch.client.slice(-4)}
          </span>
        </div>
      </div>
      
      {/* Progress bar for in-progress batches */}
      {batch.status === 1 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span>Progress:</span>
            <span className="font-silkscreen text-[10px]">60%</span>
          </div>
          <div className="w-full bg-black/20 rounded-full h-2">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: "60%" }} />
          </div>
        </div>
      )}
    </div>
  );
}