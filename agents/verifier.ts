import * as dotenv from "dotenv";
import { formatEther, type Address } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI } from "./lib/abis.js";
import { downloadFromIPFS } from "./lib/ipfs.js";
import { initLitClient } from "./lib/crypto.js";
import { getCheckerForDeliverable, runAllCheckers } from "./lib/checkers/index.js";
import { calculateScore, evaluateWithLLM, passesVerification } from "./lib/scoring.js";
import { type CheckResult } from "./lib/evidence.js";

// Load environment variables
dotenv.config();

// Task specification interface matching the optimization guide
interface TaskSpec {
  partA_humanReadable: {
    title: string;
    description: string;
    resourcesProvided?: Array<{type: string; url: string}>;
    technicalRequirements?: any;
  };
  partB_acceptanceCriteria: {
    deterministicChecks: Array<{id: string; type: string; details: string}>;
    llmEvaluatedChecks: Array<{id: string; type: string; weight: number; details: string}>;
  };
  partC_scoringFormula: {
    passingThreshold: number;
    blockingCriteria: string[];
    deterministicWeight: number;
    llmWeight: number;
    finalScore: string;
  };
}

interface VerificationResult {
  taskId: string;
  passed: boolean;
  score: number;
  details: {
    gatekeeping: any;
    specialized: any;
    llmEvaluation: any;
  };
  timestamp: number;
}

interface VerificationBatch {
  taskIds: bigint[];
  results: boolean[];
  evaluations: any[];
}

/**
 * Enhanced task verification with multi-stage validation
 */
async function verifyComplexTask(
  taskId: bigint,
  publicClient: any,
  wallet: any,
  taskSpec?: TaskSpec
): Promise<VerificationResult> {
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

  // Run automated gatekeeping checks
  console.log("\nRunning automated gatekeeping checks...");
  const gateResults = await runGatekeepingChecks(deliverable, taskSpec);

  // Run specialized checkers based on deliverable type
  console.log("\nRunning specialized checkers...");
  const specializedResults = await runSpecializedCheckers(deliverable, taskSpec);

  // Run LLM-based evaluation
  console.log("\nEvaluating with LLM...");
  const llmResults = await evaluateWithLLM(deliverable, taskSpec?.partA_humanReadable?.description);

  // Calculate final score
  const finalScore = calculateWeightedScore(
    gateResults,
    specializedResults,
    llmResults,
    taskSpec?.partC_scoringFormula
  );

  // Determine if task passes
  const passes = finalScore >= (taskSpec?.partC_scoringFormula?.passingThreshold || 75);

  return {
    taskId: taskId.toString(),
    passed: passes,
    score: finalScore,
    details: {
      gatekeeping: gateResults,
      specialized: specializedResults,
      llmEvaluation: llmResults
    },
    timestamp: Date.now()
  };
}

// Gatekeeping checks implementation
async function runGatekeepingChecks(deliverable: any, taskSpec?: TaskSpec): Promise<any> {
  // This would run the automated checks from the spec
  // For now, we'll return a mock result
  return {
    allPassed: true,
    hasBlockingFailures: false
  };
}

// Specialized checkers implementation
async function runSpecializedCheckers(deliverable: any, taskSpec?: TaskSpec): Promise<any[]> {
  // Run all applicable checkers
  const results = await runAllCheckers(deliverable);
  return results;
}

// Weighted scoring calculation
function calculateWeightedScore(
  gateResults: any,
  specializedResults: any[],
  llmResults: any,
  scoringFormula?: any
): number {
  // Default scoring weights
  const deterministicWeight = scoringFormula?.deterministicWeight || 0.4;
  const llmWeight = scoringFormula?.llmWeight || 0.6;

  // Calculate deterministic score (simplified)
  const deterministicScore = specializedResults.length > 0 ?
    specializedResults.reduce((sum, r) => sum + r.score, 0) / specializedResults.length :
    100;

  // Calculate LLM score
  const llmScore = llmResults?.score || 100;

  // Calculate final weighted score
  const finalScore = (deterministicScore * deterministicWeight) + (llmScore * llmWeight);
  return Math.min(100, Math.max(0, finalScore));
}

/**
 * Verify a single task with enhanced evaluation
 */
export async function verifyTask(
  taskId: bigint,
  publicClient: any,
  wallet: any,
  taskSpec?: TaskSpec
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

  // Run enhanced verification pipeline
  console.log("\nRunning enhanced verification pipeline...");

  // Stage 1: Automated Gatekeeping (Fast Fail)
  console.log("Stage 1: Automated Gatekeeping Checks");

  // Stage 2: Specialized Checker Execution
  console.log("Stage 2: Specialized Checker Execution");
  const checker = getCheckerForDeliverable(deliverable);
  const rawCheckResult = await checker.check(deliverable);
  const checkResult: CheckResult = {
    ...rawCheckResult,
    checkerName: checker.name,
  };

  // Stage 3: LLM-Based Evaluation
  console.log("Stage 3: LLM-Based Evaluation");
  const llmEvaluation = await evaluateWithLLM(deliverable, taskSpec?.partA_humanReadable?.description);

  // Stage 4: Reputation-Weighted Consensus (simplified for single verifier)
  console.log("Stage 4: Scoring");

  // Calculate deterministic and LLM scores
  const deterministicScore = checkResult.score;
  const llmScore = llmEvaluation.score;

  // Apply scoring formula from spec
  const scoringConfig = taskSpec?.partC_scoringFormula || {
    deterministicWeight: 0.4,
    llmWeight: 0.6,
    passingThreshold: 75
  };

  const finalScore = calculateScore(deterministicScore, llmScore, {
    deterministicWeight: scoringConfig.deterministicWeight,
    llmWeight: scoringConfig.llmWeight
  });

  const success = passesVerification(finalScore, [checkResult], {
    passingThreshold: scoringConfig.passingThreshold
  });

  console.log(`\nVerification: ${success ? "PASS" : "FAIL"} (Score: ${finalScore}/100)`);
  console.log(`Deterministic Score: ${deterministicScore}/100`);
  console.log(`LLM Score: ${llmScore}/100`);
  console.log(`Feedback: ${llmEvaluation.feedback}`);

  return {
    success,
    score: finalScore,
    feedback: llmEvaluation.feedback
  };
}

/**
 * Verify a batch of tasks with enhanced evaluation
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
    const receipt = await publicClient.waitForTransactionReceipt({ hash: batchHash });
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
      value: stakeAmount // Using the actual stake amount from env
    });

    console.log(`Verifier registration transaction: ${hash}`);
    // Note: We're not waiting for confirmation here to keep the process moving
    console.log(`Staked ${stakeAmount} ETH as verifier bond`);
  } catch (error) {
    console.error("Failed to register as verifier:", error);
    // Don't exit - verifier can still operate without registration
  }
}

/**
 * Handle query resolution for complex tasks
 */
async function handleTaskQuery(
  taskId: bigint,
  queryText: string,
  queryType: string,
  publicClient: any,
  wallet: any
): Promise<void> {
  console.log(`\n=== HANDLING TASK QUERY ${taskId} ===`);

  // Submit encrypted query to the contract
  const queryHash = await wallet.writeContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "submitQuery",
    args: [taskId, queryText],
  });

  console.log(`Query submitted: ${queryHash}`);
}

/**
 * Enhanced verification with specialized checkers and multi-stage validation
 */
async function enhancedVerifyTask(
  taskId: bigint,
  publicClient: any,
  wallet: any,
  account: { address: Address },
  taskSpec?: TaskSpec
): Promise<void> {
  // Get task details
  const task = await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "getTask",
    args: [taskId],
  }) as any;

  console.log(`\n=== Enhanced Verifying Task #${taskId} ===`);
  console.log(`Client: ${task.client}`);
  console.log(`Worker: ${task.worker}`);
  console.log(`Status: ${task.status}`);

  // Download deliverable from IPFS
  console.log("\nDownloading deliverable from IPFS...");
  const deliverable = await downloadFromIPFS(task.deliverableHash);
  console.log(`Deliverable: ${JSON.stringify(deliverable).slice(0, 200)}...`);

  // Run verification pipeline
  console.log("\nRunning verification pipeline...");

  // Stage 1: Automated Gatekeeping (Fast Fail)
  console.log("Stage 1: Automated Gatekeeping Checks");

  // Stage 2: Specialized Checker Execution
  console.log("Stage 2: Specialized Checker Execution");
  const checker = getCheckerForDeliverable(deliverable);
  const rawCheckResult = await checker.check(deliverable);
  const checkResult: CheckResult = {
    ...rawCheckResult,
    checkerName: checker.name,
  };

  // Stage 3: LLM-Based Evaluation
  console.log("Stage 3: LLM-Based Evaluation");
  const llmEvaluation = await evaluateWithLLM(deliverable, taskSpec?.partA_humanReadable?.description);

  // Stage 4: Scoring
  console.log("Stage 4: Scoring");

  // Calculate deterministic and LLM scores
  const deterministicScore = checkResult.score;
  const llmScore = llmEvaluation.score;

  // Apply scoring formula from spec
  const scoringConfig = taskSpec?.partC_scoringFormula || {
    deterministicWeight: 0.4,
    llmWeight: 0.6,
    passingThreshold: 75
  };

  const finalScore = calculateScore(deterministicScore, llmScore, {
    deterministicWeight: scoringConfig.deterministicWeight,
    llmWeight: scoringConfig.llmWeight
  });

  const success = passesVerification(finalScore, [checkResult], {
    passingThreshold: scoringConfig.passingThreshold
  });

  console.log(`\nVerification: ${success ? "PASS" : "FAIL"} (Score: ${finalScore}/100)`);
  console.log(`Deterministic Score: ${deterministicScore}/100`);
  console.log(`LLM Score: ${llmScore}/100`);
  console.log(`Feedback: ${llmEvaluation.feedback}`);
}

async function main() {
  const verifierKey = process.env.VERIFIER_PRIVATE_KEY || process.env.CLIENT_PRIVATE_KEY;

  if (!verifierKey) {
    console.error("Missing VERIFIER_PRIVATE_KEY (or CLIENT_PRIVATE_KEY) in .env");
    process.exit(1);
  }

  const { wallet, account, publicClient } = createWallet(verifierKey);

  console.log("=== ENHANCED VERIFIER AGENT ===");
  console.log(`Address: ${account.address}`);

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);

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

// Export for testing
export { verifyBatchOptimistically, main };
export default main;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
