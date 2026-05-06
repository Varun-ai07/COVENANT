"use client";

import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { getContractAddresses, isDeployed } from "@/config/contracts";
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
    query: { enabled: isDeployed(contracts.AgentRegistry) },
  });
}

export function useAllAgents() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);

  return useReadContract({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    functionName: "getAllAgents",
    query: { enabled: isDeployed(contracts.AgentRegistry) },
  });
}

/**
 * Fetch all agent addresses, then batch-fetch each agent's full data via multicall.
 * Returns the complete AgentData[] array for the leaderboard.
 */
export function useAllAgentDetails() {
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const registryDeployed = isDeployed(contracts.AgentRegistry);

  // Step 1: get all registered agent addresses
  const { data: addresses, isLoading: addressesLoading } = useReadContract({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    functionName: "getAllAgents",
    query: { enabled: registryDeployed },
  });

  const agentAddresses = (addresses as Address[]) || [];

  // Step 2: batch-fetch each agent's details via multicall
  const contractsConfig = agentAddresses.map((addr) => ({
    address: contracts.AgentRegistry as Address,
    abi: AgentRegistryABI as any,
    functionName: "getAgent" as const,
    args: [addr as Address],
  }));

  const {
    data: agentsData,
    isLoading: detailsLoading,
    isSuccess,
  } = useReadContracts({
    contracts: contractsConfig,
    query: {
      enabled: registryDeployed && agentAddresses.length > 0,
    },
  });

  // Step 3: map raw tuple results to typed AgentData
  const agents: AgentData[] = [];
  if (isSuccess && agentsData) {
    for (const result of agentsData) {
      if (result.status === "success" && result.result) {
        const raw = result.result as any[];
        const agent: AgentData = {
          did: raw[0] as `0x${string}`,
          name: raw[1] as string,
          capabilities: raw[2] as string[],
          reputation: raw[3] as bigint,
          stakedAmount: raw[4] as bigint,
          tasksCompleted: raw[5] as bigint,
          tasksFailed: raw[6] as bigint,
          totalValueTransferred: raw[7] as bigint,
          isActive: raw[8] as boolean,
          registeredAt: raw[9] as bigint,
        };
        // Skip inactive agents
        if (agent.isActive) agents.push(agent);
      }
    }
  }

  return {
    agents,
    isLoading: addressesLoading || detailsLoading,
    agentCount: agentAddresses.length,
  };
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
