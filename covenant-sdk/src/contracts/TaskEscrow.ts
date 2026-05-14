import type { Address } from "viem";

/**
 * Minimal ABI for TaskEscrow contract
 */
export const TaskEscrowABI = [
  // Read functions
  {
    name: "getTask",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      { name: "taskId", type: "uint256" },
      { name: "client", type: "address" },
      { name: "worker", type: "address" },
      { name: "payment", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "descriptionHash", type: "string" },
      { name: "deliverableHash", type: "string" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint256" },
      { name: "completedAt", type: "uint256" },
      { name: "protocolFee", type: "uint256" },
      { name: "totalValue", type: "uint256" },
    ],
  },
  {
    name: "getTaskCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getClientTasks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "client", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getWorkerTasks",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "worker", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  // Write functions
  {
    name: "createTask",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "worker", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "descriptionHash", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "fundTask",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "startTask",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "submitWork",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "deliverableHash", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "verifyTask",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "success", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "disputeTask",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "cancelTask",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  // Events
  {
    name: "TaskCreated",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "worker", type: "address", indexed: true },
      { name: "payment", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
    ],
  },
  {
    name: "WorkSubmitted",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "deliverableHash", type: "string", indexed: false },
    ],
  },
  {
    name: "TaskCompleted",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "workerPayment", type: "uint256", indexed: false },
    ],
  },
  {
    name: "TaskDisputed",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "disputedBy", type: "address", indexed: false },
    ],
  },
] as const;

export type TaskEscrowABI = typeof TaskEscrowABI;
