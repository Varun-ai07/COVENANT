"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { useChainId } from "wagmi";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import { getContractAddresses } from "@/config/contracts";
import type { Address } from "viem";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface MilestoneDisplayProps {
  taskId: bigint;
  className?: string;
}

export function useMilestoneCount(taskId?: bigint) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "getMilestoneCount",
    args: [taskId as bigint],
    query: {
      enabled: !!taskId && taskId > 0n,
    },
  });
}

export function useMilestone(taskId?: bigint, milestoneIndex?: number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "getMilestone",
    args: [taskId as bigint, BigInt(milestoneIndex || 0)],
    query: {
      enabled: !!taskId && taskId > 0n && milestoneIndex !== undefined,
    },
  });
}

interface MilestoneData {
  description: string;
  completed: boolean;
  completedAt: bigint;
}

function MilestoneItem({
  milestone,
  index,
  isLoading,
}: {
  milestone?: MilestoneData;
  index: number;
  isLoading: boolean;
}) {
  const isCompleted = milestone?.completed;

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-alt/50">
        <Loader2 size={18} className="text-accent flex-shrink-0 animate-spin" />
        <span className="text-sm text-muted">Loading milestone {index + 1}...</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
        isCompleted
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-surface-alt/50"
      }`}
    >
      {isCompleted ? (
        <CheckCircle2 size={18} className="text-accent flex-shrink-0" />
      ) : (
        <Circle size={18} className="text-charcoal flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${
            isCompleted ? "text-foreground" : "text-muted"
          } truncate`}
        >
          {milestone?.description || `Milestone ${index + 1}`}
        </p>
        {isCompleted && milestone?.completedAt && (
          <p className="text-xs text-muted mt-0.5">
            Completed at block {milestone.completedAt.toString()}
          </p>
        )}
      </div>
      {isCompleted && (
        <span className="text-xs text-accent font-mono">Done</span>
      )}
    </div>
  );
}

export default function MilestoneDisplay({
  taskId,
  className = "",
}: MilestoneDisplayProps) {
  const { data: count, isLoading: countLoading } = useMilestoneCount(taskId);

  const milestoneCount = Number(count || 0);

  // Build contracts array for useReadContracts
  const contracts = milestoneCount > 0
    ? Array.from({ length: milestoneCount }, (_, i) => ({
        address: useMilestoneCount.name, // placeholder, will be overridden
        abi: TaskEscrowABI as any,
        functionName: "getMilestone",
        args: [taskId, BigInt(i)],
      }))
    : [];

  // We need to get the contract address
  const chainId = useChainId();
  const contractAddresses = getContractAddresses(chainId);

  const milestoneQueries = useReadContracts({
    contracts: milestoneCount > 0
      ? Array.from({ length: milestoneCount }, (_, i) => ({
          address: contractAddresses.TaskEscrow as Address,
          abi: TaskEscrowABI as any,
          functionName: "getMilestone",
          args: [taskId, BigInt(i)],
        }))
      : [],
    query: {
      enabled: milestoneCount > 0,
    },
  });

  if (countLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 size={16} className="animate-spin text-accent" />
        <span className="text-sm text-muted">Loading milestones...</span>
      </div>
    );
  }

  if (milestoneCount === 0) {
    return (
      <div className={`text-sm text-muted ${className}`}>
        No milestones set for this task.
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="font-mono text-sm text-accent uppercase tracking-wider">
        Milestones ({milestoneCount})
      </h4>
      <div className="space-y-2">
        {Array.from({ length: milestoneCount }, (_, i) => {
          const data = milestoneQueries.data?.[i]?.result as MilestoneData | undefined;
          const isLoading = milestoneQueries.isLoading;

          return (
            <MilestoneItem
              key={i}
              milestone={data}
              index={i}
              isLoading={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
}
