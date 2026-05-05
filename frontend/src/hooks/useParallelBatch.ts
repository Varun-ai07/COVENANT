"use client";

import { useReadContract, useWriteContract, useChainId } from "wagmi";
import { getContractAddresses } from "@/config/contracts";
import type { Address } from "viem";
import ParallelTaskBatchABI from "@/contracts/ParallelTaskBatch.json";

export interface BatchData {
  creator: Address;
  escrowId: bigint;
  resultHash: `0x${string}`;
  status: number; // 0=Created, 1=InProgress, 2=Completed, 3=Failed
  workerCount: bigint;
  aggregatedResult: `0x${string}`;
}

export interface BatchDetails {
  creator: Address;
  escrowId: bigint;
  taskIds: bigint[];
  resultHash: `0x${string}`;
  status: number;
  workerCount: bigint;
}

export function useParallelBatch(batchId?: string | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.ParallelTaskBatch as Address,
    abi: ParallelTaskBatchABI.abi as any,
    functionName: "getBatchDetails",
    args: batchId !== undefined ? [BigInt(batchId)] : undefined,
    query: { enabled: batchId !== undefined && contracts.ParallelTaskBatch !== "0x0000000000000000000000000000000000000000" },
  });

  const raw = result.data as any[] | undefined;
  const data: BatchDetails | undefined = raw
    ? {
        creator: raw[0],
        escrowId: raw[1],
        taskIds: raw[2],
        resultHash: raw[3],
        status: Number(raw[4]),
        workerCount: raw[5],
      }
    : undefined;

  return { ...result, data };
}

export function useBatchCounter() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.ParallelTaskBatch as Address,
    abi: ParallelTaskBatchABI.abi as any,
    functionName: "batchCounter",
    query: { enabled: contracts.ParallelTaskBatch !== "0x0000000000000000000000000000000000000000" },
  });

  return { count: result.data as bigint | undefined, ...result };
}

export function useBatchStatus(batchId?: string | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.ParallelTaskBatch as Address,
    abi: ParallelTaskBatchABI.abi as any,
    functionName: "getBatchStatus",
    args: batchId !== undefined ? [BigInt(batchId)] : undefined,
    query: { enabled: batchId !== undefined && contracts.ParallelTaskBatch !== "0x0000000000000000000000000000000000000000" },
  });

  return { batchStatus: result.data as number | undefined, ...result };
}

export function useAggregatedResult(batchId?: string | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const result = useReadContract({
    address: contracts.ParallelTaskBatch as Address,
    abi: ParallelTaskBatchABI.abi as any,
    functionName: "getAggregatedResult",
    args: batchId !== undefined ? [BigInt(batchId)] : undefined,
    query: { enabled: batchId !== undefined && contracts.ParallelTaskBatch !== "0x0000000000000000000000000000000000000000" },
  });

  return { aggregatedResult: result.data as `0x${string}` | undefined, ...result };
}

export function useCreateBatch() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, isPending, data: hash, error } = useWriteContract();

  const createBatch = (
    workers: Address[],
    taskIds: bigint[],
    deadlines: bigint[],
    deliverableHashes: `0x${string}`[],
    resultHash: `0x${string}`
  ) => {
    writeContract({
      address: contracts.ParallelTaskBatch as Address,
      abi: ParallelTaskBatchABI.abi as any,
      functionName: "createBatch",
      args: [workers, taskIds, deadlines, deliverableHashes, resultHash],
    });
  };

  return { createBatch, isPending, hash, error };
}
