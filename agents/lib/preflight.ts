import { formatEther, type PublicClient, type Address } from "viem";
import { AgentRegistryABI } from "./abis.js";

interface PreflightAddresses {
  deployer: string;
  client: string;
  worker: string;
  registry: Address;
  escrow: Address;
  receipt: Address;
}

interface PreflightResult {
  clientReg: boolean;
  workerReg: boolean;
  totalCost: number;
}

export async function preflightCheck(
  publicClient: PublicClient,
  addresses: PreflightAddresses
): Promise<PreflightResult> {
  console.log("\n┌─────────────────────────────────┐");
  console.log("│     COVENANT PREFLIGHT CHECK    │");
  console.log("└─────────────────────────────────┘");

  // 1. Check wallet balances
  const deployerBal = await publicClient.getBalance({ address: addresses.deployer as Address });
  const clientBal = await publicClient.getBalance({ address: addresses.client as Address });
  const workerBal = await publicClient.getBalance({ address: addresses.worker as Address });

  console.log("\nWallet balances:");
  console.log(`  Deployer: ${formatEther(deployerBal)} ETH`);
  console.log(`  Client:   ${formatEther(clientBal)} ETH`);
  console.log(`  Worker:   ${formatEther(workerBal)} ETH`);

  // 2. Check contracts deployed
  const regCode = await publicClient.getBytecode({ address: addresses.registry });
  const escCode = await publicClient.getBytecode({ address: addresses.escrow });
  const recCode = await publicClient.getBytecode({ address: addresses.receipt });

  console.log("\nContracts:");
  console.log(`  AgentRegistry:   ${regCode && regCode !== "0x" ? "✓" : "✗ NOT DEPLOYED"}`);
  console.log(`  TaskEscrow:      ${escCode && escCode !== "0x" ? "✓" : "✗ NOT DEPLOYED"}`);
  console.log(`  ReceiptVerifier: ${recCode && recCode !== "0x" ? "✓" : "✗ NOT DEPLOYED"}`);

  if (!regCode || regCode === "0x" || !escCode || escCode === "0x" || !recCode || recCode === "0x") {
    throw new Error("Contracts not deployed. Run: cd contracts && npm run deploy:sepolia");
  }

  // 3. Check agent registration status
  const clientAgent = await publicClient.readContract({
    address: addresses.registry,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [addresses.client as Address],
  }) as { isActive: boolean; reputation: bigint };

  const workerAgent = await publicClient.readContract({
    address: addresses.registry,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [addresses.worker as Address],
  }) as { isActive: boolean; reputation: bigint };

  const clientReg = clientAgent.isActive;
  const workerReg = workerAgent.isActive;

  console.log("\nAgent status:");
  console.log(`  ClientBot: ${clientReg
    ? "✓ registered (rep: " + clientAgent.reputation + ")"
    : "✗ needs registration (costs 0.001 ETH)"}`);
  console.log(`  WorkerBot: ${workerReg
    ? "✓ registered (rep: " + workerAgent.reputation + ")"
    : "✗ needs registration (costs 0.001 ETH)"}`);

  // 4. Estimate cost for this run
  const regCost = (!clientReg ? 0.001 : 0) + (!workerReg ? 0.001 : 0);
  const demoCost = 0.001 + 0.0002; // task + gas
  const totalCost = regCost + demoCost;

  console.log(`\nEstimated cost this run: ${totalCost.toFixed(4)} ETH`);
  console.log(`  Registration: ${regCost} ETH`);
  console.log(`  Demo run:     ${demoCost} ETH`);

  // 5. Check minimum balance
  const minRequired = BigInt(Math.floor(totalCost * 1e18));
  if (clientBal < minRequired) {
    throw new Error(
      `Insufficient balance!\n` +
      `  Client wallet has: ${formatEther(clientBal)} ETH\n` +
      `  Needs at least:    ${totalCost.toFixed(4)} ETH\n` +
      `  Get testnet ETH:   https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet`
    );
  }

  console.log("\n✓ Preflight passed — starting demo\n");
  return { clientReg, workerReg, totalCost };
}
