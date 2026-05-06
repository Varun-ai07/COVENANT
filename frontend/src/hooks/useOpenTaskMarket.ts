"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainId } from "wagmi";
import OpenTaskMarketABI from "@/contracts/OpenTaskMarket.json";
import { getContractAddresses, isDeployed } from "@/config/contracts";
import type { Address } from "viem";

export interface OpenTaskData {
  client: Address;
  maxPayment: bigint;
  deadline: bigint;
  descriptionHash: string;
  status: number;
  postedAt: bigint;
  selectedWorker: Address;
  selectedPrice: bigint;
  selectedTimeEstimate: bigint;
  selectedProposalHash: string;
}

export function useOpenTaskMarket() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const isMarketDeployed = isDeployed(contracts.OpenTaskMarket);

  const { data: taskCount, isLoading: isTaskCountLoading } = useReadContract({
    address: contracts.OpenTaskMarket as Address,
    abi: OpenTaskMarketABI as any,
    functionName: "taskCount",
    query: { enabled: isMarketDeployed },
  });

  const { data: allTaskIds, isLoading: isAllTasksLoading } = useReadContract({
    address: contracts.OpenTaskMarket as Address,
    abi: OpenTaskMarketABI as any,
    functionName: "getAllTasks",
    query: { enabled: isMarketDeployed },
  });

  return {
    taskCount: taskCount as bigint | undefined,
    allTaskIds: allTaskIds as bigint[] | undefined,
    isLoading: isTaskCountLoading || isAllTasksLoading,
  };
}

export function useOpenTask(taskId?: bigint | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.OpenTaskMarket as Address,
    abi: OpenTaskMarketABI as any,
    functionName: "getTask",
    args: [BigInt(taskId || 0)],
    query: {
      enabled: taskId !== undefined,
    },
  });
}

export function useCreateOpenTask() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const createOpenTask = (
    maxPayment: bigint,
    deadline: bigint,
    descriptionHash: string
  ) => {
    writeContract({
      address: contracts.OpenTaskMarket as Address,
      abi: OpenTaskMarketABI as any,
      functionName: "postOpenTask",
      args: [maxPayment, deadline, descriptionHash],
      value: maxPayment,
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    createOpenTask,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
