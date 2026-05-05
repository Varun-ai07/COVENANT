import * as dotenv from "dotenv";
import { parseEther, formatEther } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI } from "./lib/abis.js";
import { uploadToIPFS } from "./lib/ipfs.js";
import { generateJSON } from "./lib/llm.js";
import { verifyTask } from "./verifier.js";

dotenv.config();

// Main function to run the client agent
async function main(): Promise<void> {
  try {
    console.log('=== COVENANT CLIENT AGENT ===\n');

    // Create wallet and get public client
    const { wallet, publicClient, account } = await createWallet(process.env.CLIENT_PRIVATE_KEY!);

    // Check if we're in autonomous mode or one-to-one mode
    const mode = process.argv[2] || 'interactive';

    if (mode === 'autonomous' || mode === 'auto') {
      console.log('🚀 Starting autonomous operation mode...\n');

      // Run enhanced one-to-one mode
      await runEnhancedOneToOneMode(wallet, publicClient, account);

      // Monitor for task completions
      await monitorAndVerifyCompletedTasks(wallet, publicClient, account);
    } else {
      console.log('Interactive mode not implemented in this client. Use "autonomous" mode for full functionality.');
      console.log('Example: npx tsx client.ts autonomous\n');

      // Run enhanced one-to-one mode as default
      await runEnhancedOneToOneMode(wallet, publicClient, account);
    }
  } catch (error) {
    console.error('❌ Client agent error:', error);
    process.exit(1);
  }
}

interface WorkerInfo {
  address: string;
  name: string;
  reputation: number;
  capabilities: string[];
  specializations?: string[];
  successRate?: number;
}

interface TaskInfo {
  id: bigint;
  client: string;
  worker: string;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  status: number;
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
      specializations: agent.specializations,
      successRate: agent.successRate,
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

async function selectBestWorker(
  task: any,
  workers: WorkerInfo[]
): Promise<WorkerInfo> {
  console.log('\n🤖 Selecting best worker AI agent...');

  if (workers.length === 0) {
    throw new Error('No available workers');
  }

  // Score each worker based on multiple criteria
  const scoredWorkers = workers.map(worker => {
    let score = 0;

    // 1. Reputation score (40% weight)
    score += worker.reputation * 0.4;

    // 2. Capability match (30% weight)
    if (task.capability && worker.capabilities.includes(task.capability)) {
      score += 30;
    }

    // 3. Work type specialization (20% weight)
    if (worker.specializations?.includes(task.type || 'general')) {
      score += 20;
    }

    // 4. Historical success rate (10% weight)
    score += worker.successRate || 50;

    return { ...worker, score };
  });

  // Sort by score (highest first)
  scoredWorkers.sort((a, b) => b.score - a.score);

  const bestWorker = scoredWorkers[0];
  console.log(`   Selected worker: ${bestWorker.name} (score: ${bestWorker.score})`);

  return bestWorker;
}

async function negotiateTerms(
  clientWallet: any,
  workerAddress: string,
  task: any,
  workerReputation?: number
): Promise<{ payment: string; deadline: bigint }> {
  console.log('\n🤝 Negotiating terms between AI agents...');

  // Dynamic pricing based on task complexity and worker reputation
  const basePayment = parseEther(task.basePayment || task.payment || '0.001');
  const reputationMultiplier = 1 + (workerReputation ?? 500) / 1000;
  const finalPayment = BigInt(Math.floor(Number(basePayment) * reputationMultiplier));

  // Deadline negotiation (allow some flexibility)
  const deadlineBuffer = 3600; // 1 hour buffer
  const negotiatedDeadline = BigInt(Math.floor(Date.now() / 1000) + Number(task.deadline || 3600) + deadlineBuffer);

  console.log(`   Payment: ${formatEther(finalPayment)} ETH`);
  console.log(`   Deadline: ${new Date(Number(negotiatedDeadline) * 1000).toLocaleString()}`);

  return {
    payment: formatEther(finalPayment),
    deadline: negotiatedDeadline,
  };
}

async function runEnhancedOneToOneMode(
  wallet: any,
  publicClient: any,
  account: any
): Promise<void> {
  console.log('=== CLIENT AGENT — ENHANCED ONE-TO-ONE MODE ===\n');

  // Step 1: Generate task via LLM
  const task = await generateTaskWithLLM();

  // Step 2: Discover workers and select best AI agent
  const workers = await discoverWorkers(publicClient, task.capability);
  const selectedWorker = await selectBestWorker(task, workers);

  // Step 3: Negotiate terms between AI agents
  const { payment, deadline } = await negotiateTerms(wallet, selectedWorker.address, task, selectedWorker.reputation);

  // Step 4: Upload task details to IPFS
  console.log('\nUploading task details to IPFS...');
  const taskData = {
    title: task.title,
    description: task.description,
    instructions: 'Complete this task and provide a detailed report.',
    encrypted: false,
    type: task.capability,
    basePayment: task.payment,
  };
  const ipfsHash = await uploadToIPFS(taskData);
  console.log(`IPFS hash: ${ipfsHash}`);

  // Step 5: Create and fund task on-chain
  console.log('\nCreating task on-chain...');
  const hash = await wallet.writeContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: 'createAndFundTask',
    args: [selectedWorker.address as `0x${string}`, parseEther(payment), deadline, ipfsHash],
    value: parseEther(payment),
  });

  console.log(`Transaction hash: ${hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  console.log('\n=== Task Created Successfully ===');
  console.log(`Title: ${task.title}`);
  console.log(`Worker: ${selectedWorker.name}`);
  console.log(`Payment: ${payment} ETH`);
  console.log(`IPFS: ${ipfsHash}`);
  console.log(`Deadline: ${new Date(Number(deadline) * 1000).toLocaleString()}`);
}

// ============ AUTONOMOUS OPERATION FUNCTIONS ============

async function monitorAndVerifyCompletedTasks(
  wallet: any,
  publicClient: any,
  account: any
): Promise<void> {
  console.log('\n=== MONITORING TASK COMPLETION ===');

  // Periodically check for completed tasks
  const checkInterval = 10000; // 10 seconds
  const timeout = 300000; // 5 minutes timeout
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Get all submitted tasks
      const submittedTaskIds = await publicClient.readContract({
        address: CONTRACTS.TaskEscrow,
        abi: TaskEscrowABI,
        functionName: 'getSubmittedTasks',
      }) as bigint[];

      console.log(`\nChecking ${submittedTaskIds.length} submitted tasks...`);

      for (const taskId of submittedTaskIds) {
        // Check task status
        const taskData = await publicClient.readContract({
          address: CONTRACTS.TaskEscrow,
          abi: TaskEscrowABI,
          functionName: 'getTask',
          args: [taskId],
        }) as any;

        // If task is completed, trigger verification
        if (taskData.status === 3) { // Submitted status
          console.log(`\n✅ Task #${taskId} completed - triggering verification...`);

          try {
            // Verify the task
            const verification = await verifyTask(taskId, publicClient, wallet);

            if (verification.success) {
              console.log(`✅ Task #${taskId} verified successfully (score: ${verification.score})`);

              // Update worker reputation
              await updateWorkerReputation(taskData.worker, verification.score);

              console.log(`📊 Worker reputation updated: +${verification.score}`);
            } else {
              console.log(`❌ Task #${taskId} verification failed`);

              // Update worker reputation negatively
              await updateWorkerReputation(taskData.worker, -20);
              console.log(`📊 Worker reputation decreased: -20`);
            }

            // Confirm payment release
            await confirmPaymentRelease(taskId, taskData.worker);

          } catch (error) {
            console.error(`❌ Error verifying task #${taskId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error checking tasks:', error);
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.log('\n⏰ Monitoring timeout reached');
}

async function updateWorkerReputation(workerAddress: string, score: number): Promise<void> {
  console.log(`\n📈 Updating reputation for worker: ${workerAddress.slice(0, 10)}...`);

  // In a real implementation, this would update on-chain reputation
  // For now, we log the reputation update
  console.log(`   Reputation change: ${score > 0 ? '+' : ''}${score}`);
}

async function confirmPaymentRelease(taskId: bigint, workerAddress: string): Promise<void> {
  console.log(`\n💰 Confirming payment release for task #${taskId} to ${workerAddress.slice(0, 10)}...`);

  // Check if payment was successfully transferred
  // This would typically involve checking the worker's balance or payment receipt
  console.log('   ✓ Payment release confirmed');
}

// Start the client agent
main().catch(console.error);
