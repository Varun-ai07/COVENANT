"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { Agent } from "@/types";

export function useAgent() {
  const { address, chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: agentData, isLoading, refetch } = useReadContract({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const agent = agentData as Agent | undefined;

  return {
    agent,
    isLoading,
    refetch,
    isRegistered: agent?.isActive ?? false,
    contracts,
  };
}

export function useAgentByAddress(address: `0x${string}` | undefined) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: agentData, isLoading } = useReadContract({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    agent: agentData as Agent | undefined,
    isLoading,
  };
}

export function useAgentCount() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: count } = useReadContract({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgentCount",
  });

  return count ? Number(count) : 0;
}

export function useAllAgents() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: addresses } = useReadContract({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAllAgents",
  });

  return (addresses as `0x${string}`[]) || [];
}

export function useAgentsByCapability(capability: string) {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: addresses, isLoading } = useReadContract({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgentsByCapability",
    args: capability ? [capability] : undefined,
    query: { enabled: !!capability },
  });

  return {
    addresses: (addresses as `0x${string}`[]) || [],
    isLoading,
  };
}

export function useRegisterAgent() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = (name: string, capabilities: string[], stake: string = "0.001") => {
    writeContract({
      address: contracts.AgentRegistry as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "register",
      args: [name, capabilities],
      value: parseEther(stake),
    });
  };

  return {
    register,
    isPending,
    isConfirming,
    isSuccess,
    error,
    hash,
  };
}

export function useAddStake() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const addStake = (amount: string = "0.001") => {
    writeContract({
      address: contracts.AgentRegistry as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "addStake",
      value: parseEther(amount),
    });
  };

  return {
    addStake,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  };
}
