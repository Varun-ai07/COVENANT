/**
 * Minimal ABI for DisputeResolution (v2 extension)
 */
export const DisputeResolutionABI = [
  // Read functions
  {
    name: "getDispute",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "disputeId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "taskId", type: "uint256" },
          { name: "filedBy", type: "address" },
          { name: "bondAmount", type: "uint256" },
          { name: "votingEndsAt", type: "uint256" },
          { name: "resolved", type: "bool" },
          { name: "workerWins", type: "bool" },
          { name: "workerShare", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "disputeCounter",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "DISPUTE_BOND",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "VOTING_DURATION",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write functions
  {
    name: "fileDispute",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "resolveDispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "disputeId", type: "uint256" },
      { name: "workerWins", type: "bool" },
      { name: "workerShare", type: "uint256" },
    ],
    outputs: [],
  },
  // Events
  {
    name: "DisputeFiled",
    type: "event",
    inputs: [
      { name: "disputeId", type: "uint256", indexed: true },
      { name: "taskId", type: "uint256", indexed: true },
      { name: "filedBy", type: "address", indexed: true },
    ],
  },
  {
    name: "DisputeResolved",
    type: "event",
    inputs: [
      { name: "disputeId", type: "uint256", indexed: true },
      { name: "workerWins", type: "bool", indexed: false },
      { name: "workerShare", type: "uint256", indexed: false },
    ],
  },
] as const;

export type DisputeResolutionABIType = typeof DisputeResolutionABI;
