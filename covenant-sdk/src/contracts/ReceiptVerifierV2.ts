/**
 * Minimal ABI for ReceiptVerifier v2 (ERC-8004 receipts with enum types)
 */
export const ReceiptVerifierV2ABI = [
  // Read functions
  {
    name: "getReceipt",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "receiptId", type: "bytes32" },
          { name: "issuer", type: "address" },
          { name: "counterparty", type: "address" },
          { name: "receiptType", type: "uint8" },
          { name: "dataHash", type: "bytes32" },
          { name: "timestamp", type: "uint256" },
          { name: "isValid", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "verifyReceipt",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "batchVerifyReceipts",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "receiptIds", type: "bytes32[]" }],
    outputs: [{ name: "results", type: "bool[]" }],
  },
  {
    name: "receiptCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "authorizedIssuers",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // Write functions
  {
    name: "createReceipt",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "counterparty", type: "address" },
      { name: "receiptType", type: "uint8" },
      { name: "dataHash", type: "bytes32" },
    ],
    outputs: [{ name: "receiptId", type: "bytes32" }],
  },
  {
    name: "invalidateReceipt",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "receiptId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "addAuthorizedIssuer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "issuer", type: "address" }],
    outputs: [],
  },
  {
    name: "removeAuthorizedIssuer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "issuer", type: "address" }],
    outputs: [],
  },
  // Events
  {
    name: "ReceiptCreated",
    type: "event",
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "counterparty", type: "address", indexed: true },
      { name: "receiptType", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    name: "ReceiptInvalidated",
    type: "event",
    inputs: [
      { name: "receiptId", type: "bytes32", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export type ReceiptVerifierV2ABIType = typeof ReceiptVerifierV2ABI;
