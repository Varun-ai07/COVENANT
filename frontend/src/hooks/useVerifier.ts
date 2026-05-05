"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainId } from "wagmi";
import { useAccount } from "wagmi";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import { getContractAddresses } from "@/config/contracts";
import { parseEther, formatEther } from "viem";
import type { Address } from "viem";

export function useGetSubmittedTasks() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const { data: taskIds, isLoading, refetch } = useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "getSubmittedTasks",
  });

  return {
    submittedTaskIds: (taskIds as bigint[]) || [],
    isLoading,
    refetch,
  };
}

export function useIsRegisteredVerifier(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "isRegisteredVerifier",
    args: [address as Address],
    query: {
      enabled: !!address,
    },
  });
}

export function useVerifierStake(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  const { data: stakeAmount, isLoading } = useReadContract({
    address: contracts.TaskEscrow as Address,
    abi: TaskEscrowABI as any,
    functionName: "verifierStakes",
    args: [address as Address],
    query: {
      enabled: !!address,
    },
  });

  return {
    verifierStake: stakeAmount ? formatEther(stakeAmount as bigint) : "0",
    isLoading,
  };
}

export function useRegisterVerifier() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const registerVerifier = (stakeAmount: string) => {
    const stakeWei = parseEther(stakeAmount);
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "registerVerifier",
      value: stakeWei,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    registerVerifier,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useCreateVerificationReceipt() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const createVerificationReceipt = (
    taskId: bigint | number,
    success: boolean,
    score: number,
    feedback: string
  ) => {
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "createVerificationReceipt",
      args: [BigInt(taskId), success, BigInt(score), feedback],
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    createVerificationReceipt,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useStakeOnVerification() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const stakeOnVerification = (
    taskId: bigint | number,
    verifierDecision: boolean,
    stakeAmount: string
  ) => {
    const stakeWei = parseEther(stakeAmount);
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "stakeOnVerification",
      args: [BigInt(taskId), verifierDecision],
      value: stakeWei,
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    stakeOnVerification,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useChallengeVerification() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const challengeVerification = (
    taskId: bigint | number,
    evidence: string
  ) => {
    writeContract({
      address: contracts.TaskEscrow as Address,
      abi: TaskEscrowABI as any,
      functionName: "challengeVerification",
      args: [BigInt(taskId), evidence],
    });
  };

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  return {
    challengeVerification,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}
