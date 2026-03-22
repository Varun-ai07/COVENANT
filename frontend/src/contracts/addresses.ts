// Contract addresses - using deployed addresses
const REGISTRY = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "0x86E5982aA12f9b0AB48d536BA78B4E2fCc9b1103";
const ESCROW = process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0xbb2933f2Bc773AB518dAe4Ae5340B5A325F1a504";
const VERIFIER = process.env.NEXT_PUBLIC_VERIFIER_ADDRESS || "0x3BE6849F40230b1433D4FA166E23B1789a5469Fa";

export const CONTRACT_ADDRESSES = {
  // Localhost (Hardhat) - uses same addresses for now
  31337: {
    AgentRegistry: REGISTRY,
    TaskEscrow: ESCROW,
    ReceiptVerifier: VERIFIER,
  },
  // Base Sepolia (testnet) - deployed contracts
  84532: {
    AgentRegistry: REGISTRY,
    TaskEscrow: ESCROW,
    ReceiptVerifier: VERIFIER,
  },
  // Base Mainnet
  8453: {
    AgentRegistry: "0x0000000000000000000000000000000000000000",
    TaskEscrow: "0x0000000000000000000000000000000000000000",
    ReceiptVerifier: "0x0000000000000000000000000000000000000000",
  },
} as const;

export function getContractAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES] || CONTRACT_ADDRESSES[84532];
}
