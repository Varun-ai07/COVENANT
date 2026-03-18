import * as dotenv from "dotenv";
import { parseEther, formatEther } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI } from "./lib/abis.js";
import { generateKeyPair, deriveSharedSecret, encrypt, toHex } from "./lib/crypto.js";
import { uploadToIPFS, isPinataConfigured } from "./lib/ipfs.js";
import { generateJSON } from "./lib/llm.js";

dotenv.config();

interface WorkerInfo {
  address: string;
  name: string;
  reputation: number;
  capabilities: string[];
}

async function discoverWorkers(
  publicClient: any,
  capability: string
): Promise<WorkerInfo[]> {
  console.log(`\nDiscovering workers with capability: "${capability}"...`);

  const workerAddresses = await publicClient.readContract({
    address: CONTRACTS.AgentRegistry,
    abi: AgentRegistryABI,
    functionName: "getAgentsByCapability",
    args: [capability],
  }) as string[];

  const workers: WorkerInfo[] = [];

  for (const addr of workerAddresses) {
    const agent = await publicClient.readContract({
      address: CONTRACTS.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgent",
      args: [addr],
    }) as any;

    workers.push({
      address: addr,
      name: agent.name,
      reputation: Number(agent.reputation),
      capabilities: agent.capabilities,
    });
  }

  // Sort by reputation (highest first)
  workers.sort((a, b) => b.reputation - a.reputation);

  console.log(`Found ${workers.length} workers:`);
  workers.forEach((w, i) => {
    console.log(`  ${i + 1}. ${w.name} (${w.reputation}/1000) - ${w.address.slice(0, 10)}...`);
  });

  return workers;
}

async function generateTaskWithLLM(): Promise<{
  title: string;
  description: string;
  capability: string;
  payment: string;
}> {
  console.log("\nGenerating task via LLM (OpenRouter)...");

  const task = await generateJSON(
    `You are an autonomous AI agent hiring another agent to do work. Generate a realistic task that needs to be done.

Return a JSON object with these fields:
- title: Short task title
- description: Detailed description of what needs to be done (2-3 sentences)
- capability: The required capability (one of: data-analysis, content-generation, code-review)
- payment: Payment amount in ETH as a string (use 0.001 for testnet)`,
    { maxTokens: 500 }
  );

  // Override payment to use testnet optimized amount
  task.payment = "0.001";

  console.log(`Generated task: "${task.title}"`);
  console.log(`Payment: ${task.payment} ETH`);

  return task;
}

async function main() {
  const { CLIENT_PRIVATE_KEY, WORKER_PUBLIC_KEY } = process.env;

  if (!CLIENT_PRIVATE_KEY) {
    console.error("Missing CLIENT_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const { wallet, account, publicClient } = createWallet(CLIENT_PRIVATE_KEY);

  console.log("=== CLIENT AGENT ===");
  console.log(`Address: ${account.address}`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);

  if (balance < parseEther("0.001")) {
    console.error("Insufficient balance. Need at least 0.001 ETH.");
    process.exit(1);
  }

  // Step 1: Generate task with LLM
  const task = await generateTaskWithLLM();

  // Step 2: Discover workers
  const workers = await discoverWorkers(publicClient, task.capability);

  if (workers.length === 0) {
    console.error(`No workers found with capability: ${task.capability}`);
    console.log("Trying broader search...");
    // Try any capability
    const allWorkers = await discoverWorkers(publicClient, "data-analysis");
    if (allWorkers.length === 0) {
      console.error("No workers found at all!");
      process.exit(1);
    }
  }

  const selectedWorker = workers[0];
  console.log(`\nSelected worker: ${selectedWorker.name} (${selectedWorker.address.slice(0, 10)}...)`);

  // Step 3: Prepare task details (encryption optional for demo)
  console.log("\nPreparing task details...");

  const taskData = {
    title: task.title,
    description: task.description,
    instructions: "Complete this task and provide a detailed report of your findings.",
    // For demo, we store unencrypted. Production would use ECDH encryption
    encrypted: false,
  };

  // Step 4: Upload task data to IPFS
  console.log("Uploading to IPFS...");
  const ipfsHash = await uploadToIPFS(taskData);
  console.log(`IPFS hash: ${ipfsHash}`);

  // Step 5: Create and fund task on-chain
  console.log("\nCreating task on-chain...");
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24 hours
  const paymentWei = parseEther(task.payment);

  const hash = await wallet.writeContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "createAndFundTask",
    args: [selectedWorker.address as `0x${string}`, paymentWei, deadline, ipfsHash],
    value: paymentWei,
  });

  console.log(`Transaction hash: ${hash}`);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  console.log("\n=== Task Created Successfully ===");
  console.log(`Title: ${task.title}`);
  console.log(`Worker: ${selectedWorker.name}`);
  console.log(`Payment: ${task.payment} ETH`);
  console.log(`IPFS: ${ipfsHash}`);
  console.log(`Deadline: ${new Date(Number(deadline) * 1000).toLocaleString()}`);
}

main().catch(console.error);
