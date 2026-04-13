"use client";

import { useAccount, useReadContract } from "wagmi";
import { getContractAddresses } from "@/contracts/addresses";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { Agent } from "@/types";

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