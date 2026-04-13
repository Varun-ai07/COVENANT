import * as dotenv from "dotenv";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { TaskEscrowABI } from "./lib/abis.js";
import { downloadFromIPFS } from "./lib/ipfs.js";
import { generateJSON } from "./lib/llm.js";
import { initLitClient, decrypt, fromHex, toHex } from "./lib/crypto.js";
import { verifyReputationProof, verifyCapabilityProof } from "./lib/zk-proofs.js";

dotenv.config();

interface VerificationBatch {
  taskIds: bigint[];
  results: boolean[];
  evaluations: any[];
}

/**
 * Verify a single task with LLM evaluation
 */
async function verifyTask(
  taskId: bigint,
  publicClient: any,
  wallet: any
): Promise<{ success: boolean; score: number; feedback: string }> {
  // Get task details
  const task = await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "getTask",
    args: [taskId],
  }) as any;

  console.log(`\n=== Verifying Task #${taskId} ===`);
  console.log(`Client: ${task.client}`);
  console.log(`Worker: ${task.worker}`);
  console.log(`Status: ${task.status}`);

  // Download deliverable from IPFS
  console.log("\nDownloading deliverable from IPFS...");
  const deliverable = await downloadFromIPFS(task.deliverableHash);
  console.log(`Deliverable: ${JSON.stringify(deliverable).slice(0, 200)}...`);

  // Use LLM to evaluate the work
  console.log("\nEvaluating work quality via LLM...");
  const evaluation = await generateJSON(
    `Evaluate this work deliverable and determine if it meets quality standards.

  Deliverable:
  ${JSON.stringify(deliverable, null, 2)}

  Return a JSON object with:
  - success: boolean (true if work is acceptable)
  - score: number 0-100 (quality score)
  - feedback: string (brief explanation)`,
    { maxTokens: 500 }
  );

  console.log(`\nEvaluation: ${evaluation.success ? "PASS" : "FAIL"} (Score: ${evaluation.score}/100)`);
  console.log(`Feedback: ${evaluation.feedback}`);

  return evaluation;
}

/**
 * Verify a batch of tasks optimistically
 */
async function verifyBatchOptimistically(
  publicClient: any,
  wallet: any
): Promise<void> {
  const { VERIFIER_ADDRESS } = process.env;
  
  if (!VERIFIER_ADDRESS) {
    console.error("Missing VERIFIER_ADDRESS in .env");
    process.exit(1);
  }

  console.log("\n=== BATCH VERIFICATION MODE ===");
  console.log(`Verifier Address: ${VERIFIER_ADDRESS}`);

  // Get all tasks in Submitted status (ready for verification)
  const submittedTaskIds = await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "getSubmittedTasks",
  }) as bigint[];

  console.log(`Found ${submittedTaskIds.length} tasks submitted for verification`);

  if (submittedTaskIds.length === 0) {
    console.log("No tasks to verify at this time.");
    return;
  }

  // Process in batches to avoid gas limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < submittedTaskIds.length; i += BATCH_SIZE) {
    const batchIds = submittedTaskIds.slice(i, i + BATCH_SIZE);
    console.log(`\nProcessing batch ${Math.floor(i/BATCH_SIZE) + 1} (${batchIds.length} tasks)...`);

    // Verify each task in the batch
    const batchResults: boolean[] = [];
    const batchEvaluations: any[] = [];

    for (const taskId of batchIds) {
      try {
        const evaluation = await verifyTask(taskId, publicClient, wallet);
        batchResults.push(evaluation.success);
        batchEvaluations.push(evaluation);
      } catch (error) {
        console.error(`Error verifying task ${taskId}:`, error);
        batchResults.push(false); // Default to failure on error
        batchEvaluations.push({ success: false, score: 0, feedback: "Verification error" });
      }
    }

    // Submit batch verification to chain
    console.log(`\nSubmitting batch verification for ${batchIds.length} tasks...`);
    const batchHash = await wallet.writeContract({
      address: CONTRACTS.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "verifyBatch",
      args: [batchIds, batchResults],
    });

    console.log(`Batch verification transaction: ${batchHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ batchHash });
    console.log(`Confirmed in block ${receipt.blockNumber}`);

    // Log results
    const successCount = batchResults.filter(Boolean).length;
    const failureCount = batchResults.length - successCount;
    console.log(`Batch Results: ${successCount} passed, ${failureCount} failed`);

    // Create verification receipts for successful verifications
    for (let j = 0; j < batchIds.length; j++) {
      if (batchResults[j]) {
        try {
          const receiptHash = await wallet.writeContract({
            address: CONTRACTS.TaskEscrow,
            abi: TaskEscrowABI,
            functionName: "createVerificationReceipt",
            args: [
              batchIds[j],
              batchEvaluations[j].success,
              batchEvaluations[j].score,
              batchEvaluations[j].feedback
            ],
          });
          console.log(`Verification receipt created for task ${batchIds[j]}: ${receiptHash}`);
        } catch (error) {
          console.error(`Failed to create verification receipt for task ${batchIds[j]}:`, error);
        }
      }
    }
  }
}

/**
 * Check for and respond to challenges to verifier decisions
 */
async function monitorChallenges(
  publicClient: any,
  wallet: any
): Promise<void> {
  console.log("\n=== CHALLENGE MONITORING MODE ===");
  
  // This would typically be a long-running process that watches for
  // challenge events and responds by submitting evidence or accepting penalties
  // For now, we'll just log that monitoring is active
  console.log("Challenge monitoring active (in production, this would watch for Challenge events)");
  console.log("Verifier is ready to defend their verifications with evidence if challenged");
}

/**
 * Register as a verifier with staking requirements
 */
async function registerAsVerifier(
  wallet: any
): Promise<void> {
  const { VERIFIER_STAKE_AMOUNT } = process.env;
  
  if (!VERIFIER_STAKE_AMOUNT) {
    console.warn("No VERIFIER_STAKE_AMOUNT set, skipping verifier registration");
    return;
  }

  try {
    console.log("\n=== REGISTERING AS VERIFIER ===");
    const stakeAmount = parseFloat(VERIFIER_STAKE_AMOUNT);
    
    const hash = await wallet.writeContract({
      address: CONTRACTS.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "registerVerifier",
      args: [],
      value: ethers.parseEther(stakeAmount.toString())
    });

    console.log(`Verifier registration transaction: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Verifier registration confirmed in block ${receipt.blockNumber}`);
    console.log(`Staked ${stakeAmount} ETH as verifier bond`);
  } catch (error) {
    console.error("Failed to register as verifier:", error);
    // Don't exit - verifier can still operate without registration
  }
}

async function main() {
  const { CLIENT_PRIVATE_KEY } = process.env;
  
  if (!CLIENT_PRIVATE_KEY) {
    console.error("Missing CLIENT_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const { wallet, account, publicClient } = createWallet(CLIENT_PRIVATE_KEY);

  console.log("=== OPTIMISTIC VERIFIER AGENT ===");
  console.log(`Address: ${account.address}`);
  
  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  // Register as verifier (if stake amount configured)
  await registerAsVerifier(wallet);

  // Initialize Lit Protocol for any encrypted verification needs
  await initLitClient();

  // Run batch verification
  await verifyBatchOptimistically(publicClient, wallet);

  // Monitor for challenges (in production, this would run continuously)
  await monitorChallenges(publicClient, wallet);

  console.log("\n=== Verification session complete ===");
}

main().catch(console.error);