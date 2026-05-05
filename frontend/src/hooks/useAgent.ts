"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { getContractAddresses } from "@/config/contracts";
import { useChainId } from "wagmi";
import type { Address } from "viem";

export interface AgentData {
  did: `0x${string}`;
  name: string;
  capabilities: string[];
  reputation: bigint;
  stakedAmount: bigint;
  tasksCompleted: bigint;
  tasksFailed: bigint;
  totalValueTransferred: bigint;
  isActive: boolean;
  registeredAt: bigint;
}

export function useAgent() {
  const { address } = useAccount();
  return useAgentByAddress(address);
}

export function useAgentByAddress(address?: Address) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    functionName: "getAgent",
    args: [address as Address],
    query: {
      enabled: !!address,
    },
  });
}

export function useAgentCount() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    functionName: "getAgentCount",
  });
}

export function useAllAgents() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    functionName: "getAllAgents",
  });
}

export function useAgentsByCapability(capability: string) {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    functionName: "getAgentsByCapability",
    args: [capability],
    query: {
      enabled: !!capability && capability.length > 0,
    },
  });
}

export function useRegisterAgent() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const register = (name: string, capabilities: string[], stakeAmount?: bigint) => {
    writeContract({
      address: contracts.AgentRegistry as Address,
      abi: AgentRegistryABI as any,
      functionName: "register",
      args: [name, capabilities],
      value: stakeAmount || BigInt(0),
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    register,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}

export function useAddStake() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const addStake = (amount: bigint) => {
    writeContract({
      address: contracts.AgentRegistry as Address,
      abi: AgentRegistryABI as any,
      functionName: "addStake",
      value: amount,
    });
  };

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  return {
    addStake,
    hash,
    isPending,
    isConfirming,
    isConfirmed,
    error,
  };
}
