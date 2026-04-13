"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import ParallelTaskBatchABI from "@/contracts/ParallelTaskBatch.json";
import { useToast } from "@/components/Toast";

export interface BatchTask {
  worker: string;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
}

export interface TaskBatch {
  batchId: bigint;
  client: string;
  totalBudget: bigint;
  tasks: bigint[]; // subtask taskIds from TaskEscrow
  aggregationSpec: string;
  status: number; // 0=Pending, 1=Creating, 2=Active, 3=Completed, 4=Cancelled
  createdAt: bigint;
}

export function useParallelTaskBatch() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { addToast } = useToast();

  // Read: Batch counter
  const { data: batchCounter, refetch: refetchBatchCounter } = useReadContract({
    address: contracts.ParallelTaskBatch as `0x${string}`,
    abi: ParallelTaskBatchABI,
    functionName: "batchCounter",
  });

  // Read: Get batch details
  const useBatch = (batchId: bigint | undefined) => {
    const { data: batchData, isLoading, refetch } = useReadContract({
      address: contracts.ParallelTaskBatch as `0x${string}`,
      abi: ParallelTaskBatchABI,
      functionName: "getBatch",
      args: batchId !== undefined ? [batchId] : undefined,
      query: { enabled: batchId !== undefined },
    });

    const parseBatch = (data: any): TaskBatch => ({
      batchId: data[0] || batchId,
      client: data[1],
      totalBudget: data[2],
      tasks: data[3] || [],
      aggregationSpec: data[4],
      status: Number(data[5]),
      createdAt: data[6],
    });

    return {
      batch: batchData ? parseBatch(batchData) : undefined,
      isLoading,
      refetch,
    };
  };

  // Read: Get batch status
  const useBatchStatus = (batchId: bigint | undefined) => {
    const { data: status, isLoading, refetch } = useReadContract({
      address: contracts.ParallelTaskBatch as `0x${string}`,
      abi: ParallelTaskBatchABI,
      functionName: "getBatchStatus",
      args: batchId !== undefined ? [batchId] : undefined,
      query: { enabled: batchId !== undefined },
    });

    return {
      status: status ? Number(status) : undefined,
      isLoading,
      refetch,
    };
  };

  // Write: Create batch
  const { writeContract: writeCreateBatch, data: createHash, isPending: isCreating, error: createError } = useWriteContract();
  const { isLoading: isConfirmingCreate, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({ hash: createHash });

  const createBatch = (
    workers: string[],
    payments: bigint[],
    deadlines: bigint[],
    descriptionHashes: string[],
    aggregationSpec: string
  ) => {
    writeCreateBatch({
      address: contracts.ParallelTaskBatch as `0x${string}`,
      abi: ParallelTaskBatchABI,
      functionName: "createBatch",
      args: [workers, payments, deadlines, descriptionHashes, aggregationSpec],
      value: payments.reduce((sum, p) => sum + p, 0n),
    });
    addToast({ type: "info", title: "Creating Batch", message: `Creating batch of ${workers.length} subtasks...` });
  };

  // Write: Aggregate results
  const { writeContract: writeAggregate, data: aggregateHash, isPending: isAggregating, error: aggregateError } = useWriteContract();
  const { isLoading: isConfirmingAggregate, isSuccess: isAggregateSuccess } = useWaitForTransactionReceipt({ hash: aggregateHash });

  const aggregateResults = (batchId: bigint, finalHash: string) => {
    writeAggregate({
      address: contracts.ParallelTaskBatch as `0x${string}`,
      abi: ParallelTaskBatchABI,
      functionName: "aggregateResults",
      args: [batchId, finalHash],
    });
    addToast({ type: "info", title: "Aggregating Results", message: "Finalizing batch deliverable..." });
  };

  // Events
  const { useWatchContractEvent } = require("wagmi");

  const useWatchBatchCreated = (onBatchCreated?: (batchId: number) => void) => {
    useWatchContractEvent({
      address: contracts.ParallelTaskBatch as `0x${string}`,
      abi: ParallelTaskBatchABI,
      eventName: "BatchCreated",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { batchId: bigint };
          onBatchCreated?.(Number(args.batchId));
        }
      },
    });
  };

  const useWatchBatchVerified = (onBatchVerified?: (batchId: number, results: boolean[]) => void) => {
    useWatchContractEvent({
      address: contracts.ParallelTaskBatch as `0x${string}`,
      abi: ParallelTaskBatchABI,
      eventName: "BatchVerified",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { batchId: bigint; results: boolean[] };
          onBatchVerified?.(Number(args.batchId), args.results);
        }
      },
    });
  };

  return {
    // State
    batchCounter,
    useBatch,
    useBatchStatus,
    // Mutations
    createBatch,
    aggregateResults,
    // Status
    isCreating,
    isConfirmingCreate,
    isCreateSuccess,
    createError,
    isAggregating,
    isConfirmingAggregate,
    isAggregateSuccess,
    aggregateError,
    // Events
    useWatchBatchCreated,
    useWatchBatchVerified,
  };
}
