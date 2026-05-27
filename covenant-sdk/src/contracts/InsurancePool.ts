/**
 * Minimal ABI for InsurancePool (v2 extension)
 */
export const InsurancePoolABI = [
  // Read functions
  {
    name: "getPoolBalance",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getMemberInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "member", type: "address" }],
    outputs: [
      { name: "active", type: "bool" },
      { name: "contributed", type: "uint256" },
    ],
  },
  {
    name: "getClaim",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "claimant", type: "address" },
          { name: "taskId", type: "uint256" },
          { name: "amount", type: "uint256" },
          { name: "paid", type: "bool" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "isMember",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "claimCounter",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "memberCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "COVERAGE_PERCENT",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "CLAIM_COOLDOWN",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "contributions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "lastClaimTime",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // Write functions
  {
    name: "joinPool",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "fileClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taskId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "payClaim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "claimId", type: "uint256" },
      { name: "", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  // Events
  {
    name: "MemberJoined",
    type: "event",
    inputs: [
      { name: "member", type: "address", indexed: true },
      { name: "contribution", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ClaimFiled",
    type: "event",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "claimant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ClaimPaid",
    type: "event",
    inputs: [
      { name: "claimId", type: "uint256", indexed: true },
      { name: "claimant", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export type InsurancePoolABIType = typeof InsurancePoolABI;
