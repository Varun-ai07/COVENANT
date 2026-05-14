import type { Address } from "viem";

/**
 * Minimal ABI for AgentRegistry contract
 */
export const AgentRegistryABI = [
  // Read functions
  {
    name: "getAgent",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [
      { name: "did", type: "bytes32" },
      { name: "name", type: "string" },
      { name: "capabilities", type: "string[]" },
      { name: "reputation", type: "uint256" },
      { name: "stakedAmount", type: "uint256" },
      { name: "tasksCompleted", type: "uint256" },
      { name: "tasksFailed", type: "uint256" },
      { name: "totalValueTransferred", type: "uint256" },
      { name: "isActive", type: "bool" },
      { name: "registeredAt", type: "uint256" },
      { name: "walletAddress", type: "address" },
    ],
  },
  {
    name: "getAgentCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getAgentsByCapability",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "capability", type: "string" },
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "getAllAgents",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "offset", type: "uint256" },
      { name: "limit", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address[]" }],
  },
  // Write functions
  {
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "name", type: "string" },
      { name: "capabilities", type: "string[]" },
    ],
    outputs: [],
  },
  {
    name: "deactivate",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  // Events
  {
    name: "AgentRegistered",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "did", type: "bytes32", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "stake", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ReputationUpdated",
    type: "event",
    inputs: [
      { name: "agent", type: "address", indexed: true },
      { name: "delta", type: "int256", indexed: false },
      { name: "newReputation", type: "uint256", indexed: false },
    ],
  },
] as const;

export type AgentRegistryABI = typeof AgentRegistryABI;
