import * as dotenv from "dotenv";
import { parseEther } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI } from "./lib/abis.js";

dotenv.config();

async function main() {
  const agentType = process.argv[2] || "client";
  const privateKey = agentType === "worker"
    ? process.env.WORKER_PRIVATE_KEY
    : process.env.CLIENT_PRIVATE_KEY;

  if (!privateKey) {
    console.error(`Missing ${agentType.toUpperCase()}_PRIVATE_KEY in .env`);
    process.exit(1);
  }

  const { wallet, account, publicClient } = createWallet(privateKey);

  console.log(`\n=== Registering ${agentType.toUpperCase()} Agent ===`);
  console.log(`Address: ${account.address}`);

  // Check if already registered
  const existingAgent = await publicClient.readContract({
    address: CONTRACTS.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [account.address],
  }) as any;

  if (existingAgent.isActive) {
    console.log(`Already registered as: ${existingAgent.name}`);
    console.log(`Reputation: ${existingAgent.reputation}`);
    return;
  }

  // Register agent
  const name = agentType === "worker" ? "WorkerBot" : "ClientBot";
  const capabilities = agentType === "worker"
    ? ["data-analysis", "content-generation", "code-review"]
    : ["task-creation", "verification", "hiring"];

  console.log(`\nRegistering as "${name}"...`);
  console.log(`Capabilities: ${capabilities.join(", ")}`);
  console.log(`Staking: 0.001 ETH`);

  const hash = await wallet.writeContract({
    address: CONTRACTS.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "register",
    args: [name, capabilities],
    value: parseEther("0.001"),
  });

  console.log(`\nTransaction hash: ${hash}`);
  console.log(`Waiting for confirmation...`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  // Get registered agent data
  const agent = await publicClient.readContract({
    address: CONTRACTS.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [account.address],
  }) as any;

  console.log(`\n=== Registration Complete ===`);
  console.log(`Name: ${agent.name}`);
  console.log(`DID: ${agent.did}`);
  console.log(`Reputation: ${agent.reputation}`);
  console.log(`Stake: ${Number(agent.stakedAmount) / 1e18} ETH`);
}

main().catch(console.error);
