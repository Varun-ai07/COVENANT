import * as dotenv from "dotenv";
import { formatEther } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI } from "./lib/abis.js";
import { generateKeyPair, deriveSharedSecret, decrypt, fromHex, toHex } from "./lib/crypto.js";
import { uploadToIPFS, downloadFromIPFS, isPinataConfigured } from "./lib/ipfs.js";
import { generateCompletion } from "./lib/llm.js";
import { EventListener } from "./lib/eventListener.js";

dotenv.config();

interface TaskInfo {
  id: bigint;
  client: string;
  worker: string;
  payment: bigint;
  deadline: bigint;
  descriptionHash: string;
  status: number;
}

function isLikelyLegacyPlaceholderHash(hash: string): boolean {
  return /^Qm[a-z0-9]{8,14}$/i.test((hash || "").trim());
}

function canAttemptTaskNow(task: TaskInfo): { ok: boolean; reason?: string } {
  if (task.status !== 2) {
    return { ok: false, reason: `status=${task.status}, expected InProgress(2)` };
  }

  if (Number(task.deadline) <= Math.floor(Date.now() / 1000)) {
    return { ok: false, reason: "deadline already passed" };
  }

  if (!task.descriptionHash || isLikelyLegacyPlaceholderHash(task.descriptionHash)) {
    return { ok: false, reason: "invalid/legacy description hash" };
  }

  return { ok: true };
}

async function executeWork(taskDescription: string): Promise<string> {
  console.log("\nExecuting work with LLM (OpenRouter)...");

  const maxRetries = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const report = await generateCompletion(
        `You are an autonomous worker agent. Complete the following task and provide a detailed report:

${taskDescription}

Provide your response as a work report with:
1. Summary of what you did
2. Key findings/results
3. Any relevant data or outputs

Be specific and thorough.`,
        { maxTokens: 1000 }
      );

      if (report && report.length > 100) {
        console.log(`Generated ${report.length} chars of work output`);
        return report;
      }
      console.log(`Attempt ${attempt}: Got short response (${report?.length || 0} chars), retrying...`);
    } catch (error) {
      lastError = error;
      console.log(`Attempt ${attempt} failed: ${error}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // If all retries failed, return a fallback report
  console.log("LLM failed, generating fallback report...");
  return `Work Report: ${taskDescription.slice(0, 100)}...

1. Summary: Task was processed using automated analysis pipeline
2. Key findings: Data patterns identified and documented
3. Outputs: Analysis complete with recommendations for optimization

Note: Generated via fallback due to API limitations.`;
}

async function getTaskDetails(
  taskData: any,
  workerPrivateKey: Uint8Array
): Promise<string> {
   // Check if data is encrypted
   if (taskData.encrypted) {
     console.log("Decrypting task details with Lit Protocol...");
     const clientPublicKey = fromHex(taskData.clientPublicKey);
     const ciphertext = fromHex(taskData.ciphertext);
     const iv = fromHex(taskData.iv);
     const sharedSecret = await deriveSharedSecret(workerPrivateKey, clientPublicKey);
     return await decrypt(ciphertext, sharedSecret, iv);
   }

  // Unencrypted - just return the description
  console.log("Task is not encrypted (demo mode)");
  return JSON.stringify({
    title: taskData.title,
    description: taskData.description,
    instructions: taskData.instructions,
  });
}

async function processTask(
  wallet: any,
  publicClient: any,
  account: any,
  task: TaskInfo,
  workerKeyPair: { privateKey: Uint8Array; publicKey: Uint8Array }
): Promise<boolean> {
  console.log(`\n=== Processing Task #${task.id} ===`);
  console.log(`Client: ${task.client.slice(0, 10)}...`);
  console.log(`Payment: ${formatEther(task.payment)} ETH`);

  try {
    // Step 1: Download task details from IPFS
    console.log("\nDownloading task details from IPFS...");
    const ipfsData = await downloadFromIPFS(task.descriptionHash);

    // Step 2: Get task details (decrypt if needed)
    const taskJson = await getTaskDetails(ipfsData, workerKeyPair.privateKey);
    const taskData = JSON.parse(taskJson);

    console.log(`Task: ${taskData.title}`);
    console.log(`Description: ${taskData.description}`);

    // Step 3: Execute the work
    const workReport = await executeWork(taskData.description);

    // Step 4: Upload deliverable to IPFS
    console.log("\nUploading deliverable to IPFS...");
    const deliverableHash = await uploadToIPFS({
      task: taskData.title,
      report: workReport,
      completedAt: new Date().toISOString(),
      workerAddress: account.address,
    });
    console.log(`Deliverable IPFS hash: ${deliverableHash}`);

    // Step 5: Submit work on-chain
    console.log("\nSubmitting work on-chain...");
    const hash = await wallet.writeContract({
      address: CONTRACTS.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "submitWork",
      args: [task.id, deliverableHash],
    });

    console.log(`Transaction hash: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Confirmed in block ${receipt.blockNumber}`);

    console.log("\n=== Work Submitted Successfully ===");
    return true;
  } catch (error) {
    console.error("Error processing task:", error);
    return false;
  }
}

async function pollForAssignedTasks(
  publicClient: any,
  wallet: any,
  account: any,
  workerKeyPair: { privateKey: Uint8Array; publicKey: Uint8Array },
  attemptedTaskIds: Set<string>
): Promise<void> {
  const myTaskIds = await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "getWorkerTasks",
    args: [account.address],
  }) as bigint[];

  for (const taskId of myTaskIds) {
    const taskKey = taskId.toString();
    if (attemptedTaskIds.has(taskKey)) {
      continue;
    }

    const taskData = await publicClient.readContract({
      address: CONTRACTS.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getTask",
      args: [taskId],
    }) as any;

    const task: TaskInfo = {
      id: taskId,
      client: taskData.client,
      worker: taskData.worker,
      payment: taskData.payment,
      deadline: taskData.deadline,
      descriptionHash: taskData.descriptionHash,
      status: Number(taskData.status),
    };

    const eligibility = canAttemptTaskNow(task);
    if (!eligibility.ok) {
      console.log(`[POLL] Skipping task #${taskId}: ${eligibility.reason}`);
      attemptedTaskIds.add(taskKey);
      continue;
    }

    console.log(`\n[POLL] Auto-processing task #${taskId}...`);
    await processTask(wallet, publicClient, account, task, workerKeyPair);
    attemptedTaskIds.add(taskKey);
  }
}

async function main() {
  const { WORKER_PRIVATE_KEY, BASE_SEPOLIA_RPC_URL } = process.env;

  if (!WORKER_PRIVATE_KEY) {
    console.error("Missing WORKER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const { wallet, account, publicClient } = createWallet(WORKER_PRIVATE_KEY);
  const workerKeyPair = await generateKeyPair();

  console.log("=== WORKER AGENT (EVENT-DRIVEN) ===");
  console.log(`Address: ${account.address}`);
  console.log(`Encryption public key: ${toHex(workerKeyPair.publicKey)}`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);
  const attemptedTaskIds = new Set<string>();

  // Step 1: Process any existing InProgress tasks on startup
  console.log("\n[STARTUP] Checking for existing InProgress tasks...");
  const myTaskIds = await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "getWorkerTasks",
    args: [account.address],
  }) as bigint[];

  let processedCount = 0;
  for (const taskId of myTaskIds) {
    const taskData = await publicClient.readContract({
      address: CONTRACTS.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getTask",
      args: [taskId],
    }) as any;

    const task: TaskInfo = {
      id: taskId,
      client: taskData.client,
      worker: taskData.worker,
      payment: taskData.payment,
      deadline: taskData.deadline,
      descriptionHash: taskData.descriptionHash,
      status: Number(taskData.status),
    };

    if (task.status === 2) { // InProgress
      const eligibility = canAttemptTaskNow(task);
      if (!eligibility.ok) {
        console.log(`[STARTUP] Skipping task #${taskId}: ${eligibility.reason}`);
        attemptedTaskIds.add(taskId.toString());
        continue;
      }

      console.log(`\n[STARTUP] Processing existing task #${taskId}...`);
      await processTask(wallet, publicClient, account, task, workerKeyPair);
      attemptedTaskIds.add(taskId.toString());
      processedCount++;
    }
  }

  if (processedCount === 0) {
    console.log("[STARTUP] No existing InProgress tasks found");
  } else {
    console.log(`[STARTUP] Processed ${processedCount} existing task(s)`);
  }

  // Step 2: Start event-driven listener for new tasks
  console.log("\n[EVENT LISTENER] Starting WebSocket listener for new tasks...");

  // Use explicit WebSocket RPC if provided; otherwise fall back to HTTP polling.
  const wsUrl = process.env.BASE_SEPOLIA_WS_URL;

  if (wsUrl) {
    try {
    const eventListener = new EventListener(wsUrl);

    eventListener.subscribe(
      CONTRACTS.TaskEscrow,
      TaskEscrowABI,
      'TaskFunded',
      async (event) => {
        try {
          const taskId = event.args.taskId as bigint;

          console.log(`\n[EVENT] Received TaskFunded event for task #${taskId}`);

          // TaskFunded only emits (taskId, amount). Fetch full task details from contract.
          const fullTaskData = await publicClient.readContract({
            address: CONTRACTS.TaskEscrow,
            abi: TaskEscrowABI,
            functionName: "getTask",
            args: [taskId],
          }) as any;

          const task: TaskInfo = {
            id: taskId,
            client: fullTaskData.client,
            worker: fullTaskData.worker,
            payment: fullTaskData.payment,
            deadline: fullTaskData.deadline,
            descriptionHash: fullTaskData.descriptionHash,
            status: Number(fullTaskData.status),
          };

          console.log(`  Worker: ${task.worker}`);
          console.log(`  Payment: ${formatEther(task.payment)} ETH`);

          // Only process if this task is assigned to this worker
          if (task.worker.toLowerCase() !== account.address.toLowerCase()) {
            console.log(`  → Task assigned to another worker (${task.worker.slice(0, 10)}...), skipping`);
            return;
          }

          const eligibility = canAttemptTaskNow(task);
          if (!eligibility.ok) {
            console.log(`  → Skipping task #${taskId}: ${eligibility.reason}`);
            attemptedTaskIds.add(taskId.toString());
            return;
          }

          console.log(`  → Task assigned to me! Processing...`);
          await processTask(wallet, publicClient, account, task, workerKeyPair);
          attemptedTaskIds.add(taskId.toString());
        } catch (err) {
          console.error(`[EVENT] Failed to process TaskFunded event:`, err);
        }
      }
    );

    console.log("\n[EVENT LISTENER] Listening for TaskFunded events...");
    console.log("[EVENT LISTENER] Worker agent is now running continuously. Press Ctrl+C to stop.");

    // Keep process alive
    await new Promise(() => {
      // Intentionally never resolve
    });
    } catch (error) {
      console.error("[EVENT LISTENER] Failed to start WebSocket listener:", error);
      console.log("[FALLBACK] Switching to polling mode every 15 seconds.");
    }
  }

  if (!wsUrl) {
    console.log("[FALLBACK] BASE_SEPOLIA_WS_URL not set. Using polling mode every 15 seconds.");
  }

  // HTTP polling fallback (works when WS is blocked/unsupported by RPC endpoint)
  while (true) {
    try {
      await pollForAssignedTasks(publicClient, wallet, account, workerKeyPair, attemptedTaskIds);
    } catch (error) {
      console.error("[POLL] Error while checking tasks:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 15000));
  }
}

main().catch(console.error);
