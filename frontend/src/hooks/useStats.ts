import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getContractAddresses } from "@/contracts/addresses";
import { useReadContract } from "wagmi";
import { useEffect, useState } from "react";

export const useAgentCount = () => {
  const { address, isConnected } = useAccount();
  const { data, isLoading, error } = useReadContract({
    address: isConnected && address ? getContractAddresses(84532).AgentRegistry : undefined as unknown as `0x${string}`,
    abi: [
      {
        inputs: [],
        name: "getAgentCount",
        outputs: [{ internalType: "uint256", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "getAgentCount",
    query: {
      enabled: !!isConnected && !!address,
    },
  });

  return {
    agentCount: data ? Number(data) : 0,
    isLoading,
    error,
  };
};

export const useTaskCount = () => {
  // In a real implementation, this would query a subgraph or have a view function
  // For now, returning mock data
  return {
    taskCount: 0,
    isLoading: false,
    error: null,
  };
};

export const useReceiptCount = () => {
  // In a real implementation, this would query a subgraph or have a view function
  // For now, returning mock data
  return {
    receiptCount: 0,
    isLoading: false,
    error: null,
  };
};

export const useAgentStats = () => {
  const { address, isConnected } = useAccount();
  const { data, isLoading, error } = useReadContract({
    address: isConnected && address ? getContractAddresses(84532).AgentRegistry : undefined as unknown as `0x${string}`,
    abi: [
      // We would need to add view functions to AgentRegistry for stats
      // For now, returning mock data
    ],
    functionName: "getAgentCount", // Placeholder
    query: {
      enabled: !!isConnected && !!address,
    },
  });

  // Mock data for now - in production, this would come from subgraphs or view functions
  return {
    agentCount: data ? Number(data) : 0,
    taskStats: {
      activeTasks: 0,
      completedToday: 0,
      totalVolumeETH: 0,
      successRate: 85,
      avgReputation: 650,
    },
    reputationDistribution: [
      { range: "0-399", count: 0 },
      { range: "400-599", count: 0 },
      { range: "600-799", count: 0 },
      { range: "800-1000", count: 0 },
    ],
    isLoading,
    error,
  };
};

// Function to fetch network stats from our API route
export const getNetworkStats = async () => {
  try {
    const response = await fetch('/api/network/stats');
    if (!response.ok) {
      throw new Error('Failed to fetch network stats');
    }
    return await response.json();
  } catch (error) {
    console.error('Error in getNetworkStats:', error);
    // Return mock data if API fails
    return {
      agentCount: 12,
      taskCount: 34,
      receiptCount: 28,
      agentStats: {
        activeTasks: 5,
        completedToday: 12,
        totalVolumeETH: 2.4,
        successRate: 87,
        avgReputation: 720,
      },
      reputationDistribution: [
        { range: "0-399", count: 3 },
        { range: "400-599", count: 4 },
        { range: "600-799", count: 3 },
        { range: "800-1000", count: 2 },
      ],
    };
  }
};