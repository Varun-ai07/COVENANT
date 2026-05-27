/**
 * Contract event listener — subscribes to all 5 v2 contracts on Base Sepolia
 * using viem's watchContractEvent. Logs events to stdout with timestamps.
 * Supports filtering by event name via CLI args.
 *
 * Usage:
 *   tsx src/event-listener.ts                          # all events
 *   tsx src/event-listener.ts --filter TaskCompleted   # only TaskCompleted
 *   tsx src/event-listener.ts --filter TaskCompleted,DisputeFiled
 */

import { createPublicClient, http, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import {
  CONTRACTS,
  RPC_URL,
  ts,
} from "./config.js";
import {
  agentRegistryAbi,
  taskEscrowAbi,
  receiptVerifierAbi,
  insurancePoolAbi,
  disputeResolutionAbi,
} from "./abis.js";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

function parseFilters(): Set<string> | null {
  const idx = process.argv.indexOf("--filter");
  if (idx === -1 || !process.argv[idx + 1]) return null;
  return new Set(process.argv[idx + 1]!.split(",").map((s) => s.trim()));
}

// ---------------------------------------------------------------------------
// Event formatter
// ---------------------------------------------------------------------------

function formatEvent(contract: string, eventName: string, args: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    const val = typeof v === "bigint" ? `${v} (${formatEther(v)} ETH)` : String(v);
    parts.push(`${k}=${val}`);
  }
  return `[${ts()}] [${contract}] ${eventName} { ${parts.join(", ")} }`;
}

// ---------------------------------------------------------------------------
// Watcher registration
// ---------------------------------------------------------------------------

type WatchConfig = {
  name: string;
  address: `0x${string}`;
  abi: readonly unknown[];
  events: string[];
};

const watches: WatchConfig[] = [
  {
    name: "AgentRegistry",
    address: CONTRACTS.AgentRegistry,
    abi: agentRegistryAbi,
    events: [
      "AgentRegistered",
      "ReputationUpdated",
      "AgentDeactivated",
      "StakeAdded",
      "StakeSlashed",
      "TaskRecorded",
    ],
  },
  {
    name: "TaskEscrow",
    address: CONTRACTS.TaskEscrow,
    abi: taskEscrowAbi,
    events: [
      "TaskCreated",
      "TaskFunded",
      "WorkSubmitted",
      "TaskCompleted",
      "TaskFailed",
      "TaskDisputed",
      "MilestoneCompleted",
      "SubtaskCreated",
    ],
  },
  {
    name: "ReceiptVerifier",
    address: CONTRACTS.ReceiptVerifier,
    abi: receiptVerifierAbi,
    events: ["ReceiptCreated", "ReceiptInvalidated"],
  },
  {
    name: "InsurancePool",
    address: CONTRACTS.InsurancePool,
    abi: insurancePoolAbi,
    events: ["MemberJoined", "ClaimFiled", "ClaimPaid", "PoolDeposited"],
  },
  {
    name: "DisputeResolution",
    address: CONTRACTS.DisputeResolution,
    abi: disputeResolutionAbi,
    events: ["DisputeFiled", "DisputeResolved"],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const filters = parseFilters();
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  console.log(`[${ts()}] COVENANT Event Listener — Base Sepolia`);
  console.log(`[${ts()}] RPC: ${RPC_URL}`);
  if (filters) console.log(`[${ts()}] Filtering: ${[...filters].join(", ")}`);
  console.log("─".repeat(80));

  let activeWatchers = 0;

  for (const watch of watches) {
    for (const eventName of watch.events) {
      if (filters && !filters.has(eventName)) continue;

      const unwatch = (client as any).watchContractEvent({
        address: watch.address,
        abi: watch.abi,
        eventName: eventName,
        onLogs(logs: any[]) {
          for (const log of logs) {
            const msg = formatEvent(watch.name, eventName, (log as any).args ?? {});
            console.log(msg);
          }
        },
        onError(error: any) {
          console.error(`[${ts()}] [${watch.name}] ERROR on ${eventName}:`, error.message);
        },
      });

      activeWatchers++;
    }
  }

  console.log(`[${ts()}] Watching ${activeWatchers} event types across ${watches.length} contracts`);
  console.log(`[${ts()}] Press Ctrl+C to stop\n`);

  // Keep process alive
  process.on("SIGINT", () => {
    console.log(`\n[${ts()}] Shutting down event listener...`);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(`[${ts()}] Fatal:`, err);
  process.exit(1);
});
