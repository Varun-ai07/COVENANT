import { createWalletClient, createPublicClient, http, Address, encodeFunctionData, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";
import { CONTRACTS, createWallet } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI, ParallelTaskBatchABI } from "./lib/abis.js";
import { uploadToIPFS, downloadFromIPFS } from "./lib/ipfs.js";
import { generateJSON } from "./lib/llm.js";
import { safeSubmit } from "./lib/safe.js";
import { EventListener } from "./lib/eventListener.js";

dotenv.config();

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const CHAIN = baseSepolia;

// Re-export createWallet for external use
export { createWallet };

/**
 * Orchestrator Agent - Handles 2C enhancements: Parallel task batching
 * Splits large tasks into subtasks and assigns to different workers in parallel
 */
export class OrchestratorAgent {
  walletClient: any;
  account: any;
  publicClient: any;

  constructor(privateKey: string) {
    const { wallet, account, publicClient } = createWallet(privateKey);
    this.walletClient = wallet;
    this.account = account;
    this.publicClient = publicClient;
  }

  /**
   * Decompose a large task into parallel subtasks using LLM
   */
  async decomposeTask(
    taskDescription: string,
    budget: number, // in ETH
    availableWorkers: Array<{
      address: `0x${string}`;
      capabilities: string[];
      reputation: number;
    }>
  ): Promise<
    Array<{
      worker: `0x${string}`;
      payment: bigint;
      deadline: number;
      descriptionHash: `0x${string}`;
      aggregationSpec: `0x${string}`;
    }>
  > {
    const budgetWei = parseEther(budget.toString());

    const workerList = availableWorkers
      .map(
        (w) =>
          `- Address: ${w.address}\n  Capabilities: ${w.capabilities.join(
            ", "
          )}\n  Reputation: ${w.reputation}`
      )
      .join("\n");

    const prompt = `
You are a task decomposition agent for autonomous AI work.
Large Task: ${taskDescription}
Total Budget: ${budget} ETH (${formatEther(budgetWei)} wei)
Available Workers:
${workerList}

Decompose this into parallel subtasks that can run simultaneously.
Assign each to the most suitable worker based on capabilities and reputation.
For each subtask, specify:
1. Worker address
2. Payment amount (in wei)
3. Deadline (unix timestamp)

Output as JSON array: [{worker, paymentWei, deadline}]

Constraints:
- Total payment must not exceed budget
- Each worker must be active and have reputation > 0
- Deadline must be in the future
- Maximum 50 subtasks per batch (contract limit)
`;

     try {
       const decompositionResult = await generateJSON(prompt, { maxTokens: 1000 });
       if (decompositionResult && Array.isArray(decompositionResult)) {
         const decomposition = decompositionResult as Array<{
           worker: string;
           paymentWei: string;
           deadline: number;
         }>;

         if (decomposition && decomposition.length > 0) {
           const currentDeadline = Math.floor(Date.now() / 1000) + 3600;
           return decomposition.map((subtask, index) => ({
             worker: subtask.worker as `0x${string}`,
             payment: BigInt(subtask.paymentWei),
             deadline: subtask.deadline || currentDeadline,
             descriptionHash: (`0x${index.toString(16).padStart(64, "0")}` as `0x${string}`),
             aggregationSpec: (`0x${Buffer.from("aggregation").toString("hex").padStart(64, "0")}` as `0x${string}`),
           }));
         }
       }
     } catch (error) {
       console.warn("LLM decomposition failed, using fallback. Error:", error);
     }

     // Fallback: split budget equally among first 3 workers
     const numSubtasks = Math.min(3, availableWorkers.length);
     const paymentPerSubtask = budgetWei / BigInt(numSubtasks);
     const deadline = Math.floor(Date.now() / 1000) + 3600;

     return availableWorkers.slice(0, numSubtasks).map((worker, index) => ({
       worker: worker.address,
       payment: paymentPerSubtask,
       deadline,
       descriptionHash: (`0x${index.toString(16).padStart(64, "0")}` as `0x${string}`),
       aggregationSpec: (`0x${Buffer.from("aggregation").toString("hex").padStart(64, "0")}` as `0x${string}`),
     }));
  }

  /**
   * Create a parallel task batch
   */
  async createParallelBatch(
    subtasks: Array<{
      worker: `0x${string}`;
      payment: bigint;
      deadline: number;
      descriptionHash: `0x${string}`;
      aggregationSpec: `0x${string}`;
    }>
  ): Promise<string> {
    const workers = subtasks.map((s) => s.worker);
    const payments = subtasks.map((s) => s.payment);
    const deadlines = subtasks.map((s) => BigInt(s.deadline));
    const descriptionHashes = subtasks.map((s) => s.descriptionHash);

    const aggregationSpec = subtasks[0]?.aggregationSpec ||
      ("0x74657374206167677265676174696f6e20737065632068617368" as `0x${string}`);

    const totalPayment = payments.reduce((sum, payment) => sum + payment, 0n);

    const batchData = encodeFunctionData({
      abi: ParallelTaskBatchABI,
      functionName: "createBatch",
      args: [workers, payments, deadlines, descriptionHashes, aggregationSpec],
    });

    const hash = await safeSubmit(this.publicClient, this.walletClient, {
      to: CONTRACTS.ParallelTaskBatch,
      data: batchData,
      value: totalPayment,
    });

    console.log(`Parallel batch created. TX: ${hash}`);
    return hash;
  }

   /**
    * Monitor a batch and wait for all subtasks to complete
    */
   async monitorBatch(batchId: bigint): Promise<void> {
     const maxChecks = 60;
     let checks = 0;

     while (checks < maxChecks) {
       try {
         // Check batch status via the contract
         const status = await this.publicClient.readContract({
           address: CONTRACTS.ParallelTaskBatch,
           abi: ParallelTaskBatchABI,
           functionName: "getBatchStatus",
           args: [batchId],
         });
 
         console.log(`Batch ${batchId} status: ${status}`);
 
         // Check if batch is completed (status 3 = Completed)
         // BatchStatus enum: Created(0), InProgress(1), Aggregating(2), Completed(3), Failed(4)
         if (status === 3 || status === "3") {
           console.log(`Batch ${batchId} completed!`);
           return;
         }
 
         // If batch failed, we should still return to avoid infinite loop
         if (status === 4 || status === "4") {
           console.log(`Batch ${batchId} failed!`);
           return;
         }
       } catch (error) {
         console.error(`Error checking batch status: ${error}`);
       }
 
       // Wait 15 seconds before checking again
       await new Promise(resolve => setTimeout(resolve, 15000));
       checks++;
     }
 
     console.log(`Batch ${batchId} monitoring timed out after ${maxChecks * 15}s`);
   }

  /**
   * Aggregate results from completed batch
   */
  async aggregateResults(batchId: bigint, finalHash: `0x${string}`): Promise<string> {
    const aggregateData = encodeFunctionData({
      abi: ParallelTaskBatchABI,
      functionName: "aggregateResults",
      args: [batchId, finalHash],
    });

    const hash = await safeSubmit(this.publicClient, this.walletClient, {
      to: CONTRACTS.ParallelTaskBatch,
      data: aggregateData,
    });

    console.log(`Batch ${batchId} results aggregated. TX: ${hash}`);
    return hash;
  }

  /**
   * Full flow: decompose task, create batch, monitor, and aggregate
   */
  async executeLargeTask(
    taskDescription: string,
    budget: number,
    availableWorkers: Array<{
      address: `0x${string}`;
      capabilities: string[];
      reputation: number;
    }>
  ): Promise<void> {
    console.log("\n=== ORCHESTRATOR: EXECUTING LARGE TASK ===");
    console.log(`Task: ${taskDescription}`);
    console.log(`Budget: ${budget} ETH`);
    console.log(`Available Workers: ${availableWorkers.length}`);

    // Step 1: Decompose into subtasks
    console.log("\nStep 1: Decomposing task into parallel subtasks...");
    const subtasks = await this.decomposeTask(taskDescription, budget, availableWorkers);
    console.log(`Decomposed into ${subtasks.length} subtasks`);

    // Step 2: Create batch
    console.log("\nStep 2: Creating parallel batch...");
    const txHash = await this.createParallelBatch(subtasks);

    // Step 3: Upload aggregated result spec to IPFS
    console.log("\nStep 3: Preparing aggregation spec...");
    const specHash = await uploadToIPFS({
      task: taskDescription,
      subtasks: subtasks.map((s) => ({
        worker: s.worker,
        payment: formatEther(s.payment),
      })),
      aggregationMethod: "concatenate_subtask_results",
    });
    console.log(`Aggregation spec IPFS: ${specHash}`);

     // Step 4: Monitor batch (polling)
     console.log("\nStep 4: Monitoring batch completion...");
     // Wait for the batch creation transaction to be mined
     const batchReceipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
     
     // Get the batch ID from the BatchCreated event
     // In a real implementation, we would parse events properly
     // For simplicity, we'll assume the batch ID is 1 (first batch)
     const batchId = 1n;
     console.log(`Monitoring batch ID: ${batchId}`);
     
     await this.monitorBatch(batchId);

    console.log("\n=== ORCHESTRATOR: TASK EXECUTION COMPLETE ===");
  }

  /**
   * Run orchestrator in daemon mode (event-driven batch monitoring)
   */
  async runDaemon(): Promise<void> {
    console.log("\n[ORCHESTRATOR DAEMON] Starting event-driven orchestrator...");

    try {
      const wsUrl = process.env.BASE_SEPOLIA_RPC_URL?.replace('https', 'wss')?.replace('http', 'ws') || 'wss://sepolia.base.org';
      const eventListener = new EventListener(wsUrl);

       // Listen for BatchCreated events to auto-trigger monitoring
   eventListener.subscribe(
     CONTRACTS.ParallelTaskBatch,
     ParallelTaskBatchABI,
     'BatchCreated',
     async (event) => {
       const batchId = event.args.batchId as bigint;
       console.log(`\n[EVENT] BatchCreated: #${batchId}`);
       // Could auto-trigger monitoring here if desired
     }
   );

      // Listen for BatchVerified (all subtasks completed)
      eventListener.subscribe(
        CONTRACTS.ParallelTaskBatch,
        ParallelTaskBatchABI,
        'BatchVerified',
        async (event) => {
          const batchId = event.args.batchId as bigint;
          const results = event.args.results as boolean[];
          console.log(`\n[EVENT] BatchVerified: #${batchId}, ${results.filter(r => r).length}/${results.length} passed`);
        }
      );

      console.log("[ORCHESTRATOR DAEMON] Listening for ParallelTaskBatch events...");
      console.log("[ORCHESTRATOR DAEMON] Press Ctrl+C to stop.");

      // Keep alive
      await new Promise(() => {});
    } catch (error) {
      console.error("[ORCHESTRATOR DAEMON] Error:", error);
      process.exit(1);
    }
  }
}

// ==================== MAIN ====================

async function main() {
  const { ORCHESTRATOR_PRIVATE_KEY } = process.env;

  if (!ORCHESTRATOR_PRIVATE_KEY) {
    console.error("Missing ORCHESTRATOR_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const agent = new OrchestratorAgent(ORCHESTRATOR_PRIVATE_KEY);

  console.log("=== ORCHESTRATOR AGENT ===");
  console.log(`Address: ${agent.account.address}`);

  // Check balance
  const balance = await agent.publicClient.getBalance({ address: agent.account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);

  const args = process.argv.slice(2);
  if (args.includes('--daemon') || args.includes('--listen')) {
    await agent.runDaemon();
  } else {
    // Example: run a sample large task (or could be driven by CLI args)
    console.log("\n[DEMO] Running sample large task decomposition...");
    // In a real scenario, you'd fetch available workers from registry
    // For now, just show the capability
    console.log("Use --daemon to start event-driven orchestrator.");
  }
}

main().catch(console.error);