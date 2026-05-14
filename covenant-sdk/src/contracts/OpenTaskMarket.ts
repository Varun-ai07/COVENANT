import type { Address } from "viem";

/**
 * Minimal ABI for OpenTaskMarket contract
 */
export const OpenTaskMarketABI = [
  // Read functions
  {
    name: "getOpenTask",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [
      { name: "client", type: "address" },
      { name: "maxPayment", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "descriptionHash", type: "string" },
      { name: "bidders", type: "address[]" },
      { name: "selectedWorker", type: "address" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    name: "getBid",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "bidder", type: "address" },
    ],
    outputs: [
      { name: "price", type: "uint256" },
      { name: "timeEstimate", type: "uint256" },
      { name: "proposalHash", type: "string" },
      { name: "bidAt", type: "uint256" },
    ],
  },
  {
    name: "getOpenTaskCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write functions
  {
    name: "postOpenTask",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "maxPayment", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "descriptionHash", type: "string" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "submitBid",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "timeEstimate", type: "uint256" },
      { name: "proposalHash", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "selectWorker",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "worker", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "withdrawBid",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  // Events
  {
    name: "TaskPosted",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "client", type: "address", indexed: true },
      { name: "maxPayment", type: "uint256", indexed: false },
      { name: "deadline", type: "uint256", indexed: false },
      { name: "descriptionHash", type: "string", indexed: false },
    ],
  },
  {
    name: "BidSubmitted",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "bidder", type: "address", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "timeEstimate", type: "uint256", indexed: false },
      { name: "proposalHash", type: "string", indexed: false },
    ],
  },
  {
    name: "WorkerSelected",
    type: "event",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "worker", type: "address", indexed: true },
      { name: "selectedPrice", type: "uint256", indexed: false },
    ],
  },
] as const;

export type OpenTaskMarketABI = typeof OpenTaskMarketABI;
