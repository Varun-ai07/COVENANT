"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainId } from "wagmi";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import { getContractAddresses } from "@/config/contracts";
import type { Address } from "viem";

export interface TaskData {
  client: Address;
  worker: Address;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  deliverableHash: string;
  status: number;
  createdAt: bigint;
  completedAt: bigint;
}

export function useTask(taskId?: bigint | number) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "getTask",
    args: [BigInt(taskId || 0)],
    query: {
      enabled: taskId !== undefined,
    },
  });
}

export function useTaskCounter() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "taskCounter",
  });
}

export function useClientTasks(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "getClientTasks",
    args: [address as Address],
    query: {
      enabled: !!address,
    },
  });
}

export function useWorkerTasks(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "getWorkerTasks",
    args: [address as Address],
    query: {
      enabled: !!address,
    },
  });
}

export function useCreateTask() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const createTask = (
    worker: Address,
    payment: bigint,
    deadline: bigint,
    descriptionHash: string
  ) => {
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "createAndFundTask",
      args: [worker, payment, deadline, descriptionHash],
      value: payment,
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    createTask,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

export function useSubmitWork() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const submitWork = (taskId: bigint | number, deliverableHash: string) => {
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "submitWork",
      args: [BigInt(taskId), deliverableHash],
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    submitWork,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

export function useVerifyTask() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const verifyTask = (taskId: bigint | number, success: boolean) => {
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "verifyTask",
      args: [BigInt(taskId), success],
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    verifyTask,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

export function useDisputeTask() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const disputeTask = (taskId: bigint | number) => {
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "disputeTask",
      args: [BigInt(taskId)],
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    disputeTask,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

export function useResolveDispute() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const resolveDispute = (taskId: bigint | number, workerWins: boolean) => {
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "resolveDispute",
      args: [BigInt(taskId), workerWins],
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    resolveDispute,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
