import * as dotenv from "dotenv";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { TaskEscrowABI } from "./lib/abis.js";
import { downloadFromIPFS } from "./lib/ipfs.js";
import { generateJSON, isOpenRouterConfigured } from "./lib/llm.js";

dotenv.config();

interface DisputeDecision {
  workerWins: boolean;
  reason: string;
}

function pickResolverKey(): string | undefined {
  return (
    process.env.DISPUTE_RESOLVER_PRIVATE_KEY ||
    process.env.PRIVATE_KEY ||
    process.env.CLIENT_PRIVATE_KEY
  );
}

async function decideDispute(taskId: bigint, taskData: any): Promise<DisputeDecision> {
  const deliverableHash = String(taskData.deliverableHash || "").trim();

  if (!deliverableHash) {
    return { workerWins: false, reason: "No deliverable submitted" };
  }

  try {
    const deliverable = await downloadFromIPFS<any>(deliverableHash);

    const report = typeof deliverable?.report === "string" ? deliverable.report : "";

    if (isOpenRouterConfigured() && report.length > 0) {
      try {
        const llmDecision = await generateJSON<{ workerWins: boolean; reason: string }>(
          `You are an autonomous arbitration agent for COVENANT.

Task ID: ${taskId}
Deliverable JSON:
${JSON.stringify(deliverable, null, 2)}

Return JSON with:
- workerWins: boolean
- reason: short string (max 120 chars)

Rules:
- If deliverable appears empty or invalid, workerWins=false.
- If deliverable is substantive and coherent, workerWins=true.`,
          { maxTokens: 300 }
        );

        if (typeof llmDecision?.workerWins === "boolean") {
          return {
            workerWins: llmDecision.workerWins,
            reason: llmDecision.reason || "LLM arbitration decision",
          };
        }
      } catch {
        // Fall through to deterministic fallback.
      }
    }

    if (report.length >= 160) {
      return { workerWins: true, reason: "Deliverable report appears substantive" };
    }

    return { workerWins: false, reason: "Deliverable quality/length below threshold" };
  } catch {
    return { workerWins: false, reason: "Deliverable cannot be retrieved from IPFS" };
  }
}

async function resolveAllDisputesOnce(
  wallet: any,
  publicClient: any,
  resolved: Set<string>
): Promise<void> {
  const taskCounter = (await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "taskCounter",
  })) as bigint;

  for (let i = 1n; i <= taskCounter; i++) {
    const key = i.toString();
    if (resolved.has(key)) {
      continue;
    }

    const task = await publicClient.readContract({
      address: CONTRACTS.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getTask",
      args: [i],
    }) as any;

    const status = Number(task.status);
    if (status !== 6) {
      continue;
    }

    console.log(`\n[DISPUTE] Found disputed task #${i}`);

    const decision = await decideDispute(i, task);
    console.log(`[DISPUTE] Decision for #${i}: workerWins=${decision.workerWins} (${decision.reason})`);

    try {
      const hash = await wallet.writeContract({
        address: CONTRACTS.TaskEscrow,
        abi: TaskEscrowABI,
        functionName: "resolveDispute",
        args: [i, decision.workerWins],
      });

      console.log(`[DISPUTE] Sent resolve tx for #${i}: ${hash}`);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`[DISPUTE] Task #${i} resolved on-chain`);
      resolved.add(key);
    } catch (error) {
      console.error(`[DISPUTE] Failed to resolve task #${i}:`, error);
    }
  }
}

async function main() {
  const resolverKey = pickResolverKey();
  if (!resolverKey) {
    console.error("Missing resolver key. Set DISPUTE_RESOLVER_PRIVATE_KEY or PRIVATE_KEY.");
    process.exit(1);
  }

  const { wallet, account, publicClient } = createWallet(resolverKey);
  console.log("=== AUTONOMOUS DISPUTE RESOLVER AGENT ===");
  console.log(`Resolver address: ${account.address}`);

  const owner = (await publicClient.readContract({
    address: CONTRACTS.TaskEscrow,
    abi: TaskEscrowABI,
    functionName: "owner",
  })) as string;

  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`Resolver wallet is not TaskEscrow owner. Owner is ${owner}`);
    process.exit(1);
  }

  console.log("Owner check passed. Monitoring disputes...");

  const resolvedTaskIds = new Set<string>();
  const intervalMs = Number(process.env.DISPUTE_POLL_INTERVAL_MS || "15000");

  while (true) {
    try {
      await resolveAllDisputesOnce(wallet, publicClient, resolvedTaskIds);
    } catch (error) {
      console.error("[DISPUTE] Loop error:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
