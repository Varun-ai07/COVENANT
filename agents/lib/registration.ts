import * as fs from "fs";
import { parseEther, formatEther, type WalletClient, type PublicClient, type Address } from "viem";
import { AgentRegistryABI } from "./abis.js";
import { TESTNET_CONFIG, type CONTRACTS } from "./config.js";

const REG_FILE = ".registered.json";

interface RegisteredData {
  [address: string]: {
    name: string;
    registeredAt: string;
    network: string;
  };
}

function loadRegisteredData(): RegisteredData {
  if (fs.existsSync(REG_FILE)) {
    return JSON.parse(fs.readFileSync(REG_FILE, "utf8"));
  }
  return {};
}

function saveToFile(address: string, name: string) {
  const data = loadRegisteredData();
  data[address] = {
    name,
    registeredAt: new Date().toISOString(),
    network: "baseSepolia",
  };
  fs.writeFileSync(REG_FILE, JSON.stringify(data, null, 2));
}

export async function registerIfNeeded(
  wallet: WalletClient,
  account: { address: Address },
  publicClient: PublicClient,
  name: string,
  capabilities: string[],
  contracts: typeof CONTRACTS
) {
  // Check on-chain first (source of truth)
  const agent = await publicClient.readContract({
    address: contracts.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [account.address],
  }) as { isActive: boolean; reputation: bigint; tasksCompleted: bigint; stakedAmount: bigint };

  if (agent.isActive) {
    console.log(`\n✓ ${name} already registered on-chain`);
    console.log(`  Address:    ${account.address}`);
    console.log(`  Reputation: ${agent.reputation}/1000`);
    console.log(`  Tasks done: ${agent.tasksCompleted}`);
    console.log(`  Stake:      ${formatEther(agent.stakedAmount)} ETH`);
    console.log(`  → Skipping registration — saving ${TESTNET_CONFIG.AGENT_STAKE} ETH\n`);
    saveToFile(account.address, name);
    return agent;
  }

  // Not registered — register now
  console.log(`\nRegistering ${name} for the first time...`);
  const stake = parseEther(TESTNET_CONFIG.AGENT_STAKE);
  const hash = await wallet.writeContract({
    address: contracts.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "register",
    args: [name, capabilities],
    value: stake,
  });
  console.log(`  TX: ${hash}`);
  console.log(`  Basescan: https://sepolia.basescan.org/tx/${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✓ Registered in block ${receipt.blockNumber}`);

  saveToFile(account.address, name);
  return await publicClient.readContract({
    address: contracts.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [account.address],
  });
}
