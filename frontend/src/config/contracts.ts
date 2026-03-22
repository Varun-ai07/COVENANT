// Contract configuration for COVENANT
export const CONTRACTS = {
  AgentRegistry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as string,
  TaskEscrow: process.env.NEXT_PUBLIC_ESCROW_ADDRESS as string,
  ReceiptVerifier: process.env.NEXT_PUBLIC_VERIFIER_ADDRESS as string,
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 84532,
  explorerUrl: "https://sepolia.basescan.org",
};

export function getExplorerLink(
  type: "address" | "tx",
  value: string
): string {
  return `${CONTRACTS.explorerUrl}/${type}/${value}`;
}

export function shortenAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
