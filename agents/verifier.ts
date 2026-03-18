import * as dotenv from "dotenv";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { TaskEscrowABI } from "./lib/abis.js";
import { downloadFromIPFS } from "./lib/ipfs.js";
import { generateJSON } from "./lib/llm.js";

dotenv.config();

async function verifyTask(taskId: bigint, publicClient: any, wallet: any) {
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

  // Verify task on-chain
  console.log("\nVerifying task on-chain...");
  const hash = await wallet.writeContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "verifyTask",
    args: [taskId, evaluation.success],
  });

  console.log(`Transaction hash: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);

  console.log(`\n=== Task ${evaluation.success ? "APPROVED ✓" : "REJECTED ✗"} ===`);
}

async function main() {
  const { CLIENT_PRIVATE_KEY } = process.env;

  if (!CLIENT_PRIVATE_KEY) {
    console.error("Missing CLIENT_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const { wallet, account, publicClient } = createWallet(CLIENT_PRIVATE_KEY);

  console.log("=== VERIFIER AGENT ===");
  console.log(`Address: ${account.address}`);

  // Get all tasks for this client
  const taskIds = await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "getClientTasks",
    args: [account.address],
  }) as bigint[];

  console.log(`\nFound ${taskIds.length} tasks`);

  // Verify tasks that are in "Submitted" status (3)
  for (const taskId of taskIds) {
    const task = await publicClient.readContract({
      address: CONTRACTS.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getTask",
      args: [taskId],
    }) as any;

    // Status 3 = Submitted (awaiting verification)
    if (Number(task.status) === 3) {
      await verifyTask(taskId, publicClient, wallet);
    } else {
      console.log(`\nTask #${taskId}: Status = ${task.status} (not submitted yet)`);
    }
  }

  console.log("\n=== Verification complete ===");
}

main().catch(console.error);
