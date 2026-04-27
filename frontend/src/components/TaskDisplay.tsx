// Shared task display component for the COVENANT frontend
import { formatEther } from "viem";
import { useReadContract } from "wagmi";
import { TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";
import { getContractAddresses } from "@/contracts/addresses";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import { formatAddress } from "@/utils/formatters";

interface TaskDisplayProps {
  taskId: bigint;
  contracts: ReturnType<typeof getContractAddresses>;
  variant?: "card" | "list" | "compact";
  className?: string;
}

interface TaskData {
  client: string;
  worker: string;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  deliverableHash: string;
  status: number;
  createdAt: bigint;
  completedAt: bigint;
}

interface StatusConfig {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

const getStatusConfig = (status: TaskStatus): StatusConfig => {
  const statusConfig: Record<number, StatusConfig> = {
    0: { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-400", dot: "bg-slate-400" },
    1: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-400" },
    2: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", dot: "bg-blue-400" },
    3: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", dot: "bg-violet-400" },
    4: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-400" },
    5: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", dot: "bg-red-400" },
  };

  return statusConfig[status] || statusConfig[0];
};

export function TaskDisplay({ taskId, contracts, variant = "card", className = "" }: TaskDisplayProps) {
  const { data: taskData } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "getTask",
    args: [taskId],
  });

  if (!taskData) return null;

  const task = taskData as TaskData;
  const status = task.status as TaskStatus;
  const statusLabel = TASK_STATUS_LABELS[status] || "Unknown";
  const statusColor = TASK_STATUS_COLORS[status] || "bg-gray-500";
  const config = getStatusConfig(status);

  const deadlineDate = new Date(Number(task.deadline) * 1000);
  const isPastDeadline = deadlineDate < new Date();

  if (variant === "compact") {
    return (
      <div className={`flex items-center justify-between p-3 rounded-lg ${className}`}>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <span className="text-slate-500 text-xs">Task #{taskId.toString()}</span>
            <span className={`text-xs px-2 py-1 rounded ${config.bg} ${config.text} font-medium`}>
              {statusLabel}
            </span>
          </div>
          <div className="text-right">
            <span className="text-white font-semibold">{formatEther(task.payment)} ETH</span>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={`flex items-center justify-between p-3 ${className}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-xs">Task #{taskId.toString()}</span>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${config.bg} ${config.text} text-xs rounded-lg font-medium`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="text-white font-mono text-sm flex-1 truncate">
              {formatAddress(task.client, 6)}...{formatAddress(task.worker, 4)}
            </div>
            <div className="text-right">
              <span className="text-white font-semibold">{formatEther(task.payment)} ETH</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default card variant
  return (
    <div className={`glass-card card-inner-glow p-5 ${className}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-slate-500 text-xs font-medium">Task #{taskId.toString()}</span>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${config.bg} ${config.text} text-xs rounded-lg border font-medium`}>
              <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
              {statusLabel}
            </span>
            {isPastDeadline && status === TaskStatus.InProgress && (
              <span className="px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
                Overdue
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-white font-semibold text-lg">{formatEther(task.payment)}</span>
          <span className="text-slate-500 text-sm ml-1">ETH</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
        <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
          <span className="text-slate-500 text-xs block mb-0.5">Client</span>
          <span className="text-slate-300 font-mono text-xs">
            {formatAddress(task.client, 6)}...{formatAddress(task.client, -4)}
          </span>
        </div>
        <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
          <span className="text-slate-500 text-xs block mb-0.5">Worker</span>
          <span className="text-slate-300 font-mono text-xs">
            {formatAddress(task.worker, 6)}...{formatAddress(task.worker, -4)}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500">
        <span className="font-mono">IPFS: {task.descriptionHash.slice(0, 16)}...</span>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {deadlineDate.toLocaleDateString()}
        </span>
      </div>

      <div className="mt-4 h-1 bg-black/30 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.dot}`}
          style={{
            width: `${Math.min((status / 4) * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  );
}

// Task display utility functions
export const TaskUtils = {
  formatTaskId: (taskId: bigint): string => {
    return `#${taskId.toString()}`;
  },

  formatStatus: (status: TaskStatus): string => {
    return TASK_STATUS_LABELS[status] || "Unknown";
  },

  getStatusColor: (status: TaskStatus): string => {
    return TASK_STATUS_COLORS[status] || "bg-gray-500";
  },

  isOverdue: (deadline: number): boolean => {
    return new Date(Number(deadline) * 1000) < new Date();
  }
};

export default TaskDisplay;