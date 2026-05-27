/**
 * Minimal ABIs for monitoring — events + key view functions only.
 * Extracted from compiled v2 contract artifacts.
 */

export const agentRegistryAbi = [
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: true, name: "did", type: "bytes32" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ReputationUpdated",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "delta", type: "int256" },
      { indexed: false, name: "newReputation", type: "uint16" },
    ],
  },
  {
    type: "event",
    name: "AgentDeactivated",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "StakeAdded",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "StakeSlashed",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "reason", type: "string" },
    ],
  },
  {
    type: "event",
    name: "TaskRecorded",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
      { indexed: false, name: "success", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "agentCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "agents",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "did", type: "bytes32" },
      { name: "wallet", type: "address" },
      { name: "reputation", type: "uint16" },
      { name: "isActive", type: "uint8" },
      { name: "tasksCompleted", type: "uint32" },
      { name: "tasksFailed", type: "uint16" },
      { name: "stakedAmount", type: "uint96" },
      { name: "registeredAt", type: "uint48" },
      { name: "lastTaskAt", type: "uint48" },
      { name: "totalValueTransacted", type: "uint128" },
    ],
    stateMutability: "view",
  },
] as const;

export const taskEscrowAbi = [
  {
    type: "event",
    name: "TaskCreated",
    inputs: [
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: true, name: "client", type: "address" },
      { indexed: true, name: "worker", type: "address" },
      { indexed: false, name: "payment", type: "uint256" },
      { indexed: false, name: "deadline", type: "uint256" },
      { indexed: false, name: "priority", type: "uint8" },
    ],
  },
  {
    type: "event",
    name: "TaskFunded",
    inputs: [
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "WorkSubmitted",
    inputs: [
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: false, name: "deliverableHash", type: "bytes32" },
    ],
  },
  {
    type: "event",
    name: "TaskCompleted",
    inputs: [
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: false, name: "workerPayment", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "TaskFailed",
    inputs: [
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: false, name: "refundAmount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "TaskDisputed",
    inputs: [
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: false, name: "disputedBy", type: "address" },
    ],
  },
  {
    type: "event",
    name: "MilestoneCompleted",
    inputs: [
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: false, name: "milestoneIndex", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "SubtaskCreated",
    inputs: [
      { indexed: true, name: "parentTaskId", type: "uint256" },
      { indexed: true, name: "childTaskId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "taskCounter",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tasks",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "client", type: "address" },
      { name: "worker", type: "address" },
      { name: "payment", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "descriptionHash", type: "bytes32" },
      { name: "deliverableHash", type: "bytes32" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint256" },
      { name: "completedAt", type: "uint256" },
      { name: "priority", type: "uint8" },
      { name: "usesMilestones", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "accumulatedFees",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const receiptVerifierAbi = [
  {
    type: "event",
    name: "ReceiptCreated",
    inputs: [
      { indexed: true, name: "receiptId", type: "bytes32" },
      { indexed: true, name: "issuer", type: "address" },
      { indexed: true, name: "counterparty", type: "address" },
      { indexed: false, name: "receiptType", type: "uint8" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ReceiptInvalidated",
    inputs: [
      { indexed: true, name: "receiptId", type: "bytes32" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "receiptCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const insurancePoolAbi = [
  {
    type: "event",
    name: "MemberJoined",
    inputs: [
      { indexed: true, name: "member", type: "address" },
      { indexed: false, name: "contribution", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ClaimFiled",
    inputs: [
      { indexed: true, name: "claimId", type: "uint256" },
      { indexed: true, name: "claimant", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ClaimPaid",
    inputs: [
      { indexed: true, name: "claimId", type: "uint256" },
      { indexed: true, name: "claimant", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "PoolDeposited",
    inputs: [
      { indexed: true, name: "member", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "totalPoolBalance",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "memberCount",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimCounter",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claims",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "claimant", type: "address" },
      { name: "taskId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "paid", type: "bool" },
      { name: "timestamp", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;

export const disputeResolutionAbi = [
  {
    type: "event",
    name: "DisputeFiled",
    inputs: [
      { indexed: true, name: "disputeId", type: "uint256" },
      { indexed: true, name: "taskId", type: "uint256" },
      { indexed: true, name: "filedBy", type: "address" },
    ],
  },
  {
    type: "event",
    name: "DisputeResolved",
    inputs: [
      { indexed: true, name: "disputeId", type: "uint256" },
      { indexed: false, name: "workerWins", type: "bool" },
      { indexed: false, name: "workerShare", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "disputeCounter",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "disputes",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "taskId", type: "uint256" },
      { name: "filedBy", type: "address" },
      { name: "bondAmount", type: "uint256" },
      { name: "votingEndsAt", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "workerWins", type: "bool" },
      { name: "workerShare", type: "uint256" },
    ],
    stateMutability: "view",
  },
] as const;
