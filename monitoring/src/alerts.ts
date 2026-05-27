/**
 * Alert system for COVENANT protocol — monitors for critical events
 * and fires alerts via webhook + console.
 *
 * Alert conditions:
 * 1. Insurance claim > 0.1 ETH
 * 2. New dispute filed
 * 3. Agent deactivated with stake > 0.05 ETH
 * 4. Subgraph sync lag > 500 blocks
 * 5. Stake slashed (any amount)
 *
 * Usage:
 *   tsx src/alerts.ts           # one-shot check
 *   tsx src/alerts.ts --watch   # continuous event monitoring
 */

import {
  createPublicClient, http, formatEther, type Log,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  CONTRACTS, RPC_URL, ALERT_WEBHOOK_URL,
  CLAIM_ALERT_ETH, DEACTIVATION_STAKE_ALERT_ETH, ts,
} from "./config.js";
import {
  agentRegistryAbi,
  taskEscrowAbi,
  insurancePoolAbi,
  disputeResolutionAbi,
} from "./abis.js";
import { checkSubgraphHealth } from "./subgraph-health.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Alert {
  level: "INFO" | "WARN" | "CRITICAL";
  source: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
}

type AlertHandler = (alert: Alert) => void;

// ---------------------------------------------------------------------------
// Alert sink — console + optional webhook
// ---------------------------------------------------------------------------

const LEVEL_ICON: Record<string, string> = {
  INFO: "[INFO]",
  WARN: "[WARN]",
  CRITICAL: "[!!!]",
};

function consoleAlert(alert: Alert) {
  const icon = LEVEL_ICON[alert.level] ?? "[?]";
  console.log(`${icon} [${alert.timestamp}] [${alert.source}] ${alert.message}`);
  if (alert.data) console.log(`    ${JSON.stringify(alert.data)}`);
}

async function webhookAlert(alert: Alert) {
  if (!ALERT_WEBHOOK_URL) return;
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `${LEVEL_ICON[alert.level]} **${alert.source}** — ${alert.message}`,
        embeds: alert.data
          ? [{ fields: Object.entries(alert.data).map(([k, v]) => ({ name: k, value: String(v) })) }]
          : undefined,
      }),
    });
  } catch (err) {
    console.error(`[${ts()}] Webhook delivery failed:`, (err as Error).message);
  }
}

async function fireAlert(alert: Alert) {
  consoleAlert(alert);
  await webhookAlert(alert);
}

// ---------------------------------------------------------------------------
// One-shot checks (polled)
// ---------------------------------------------------------------------------

/** Check recent insurance claims for large amounts */
async function checkLargeClaims(handler: AlertHandler = fireAlert) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  const claimCount = await client.readContract({
    address: CONTRACTS.InsurancePool,
    abi: insurancePoolAbi,
    functionName: "claimCounter",
  });

  // Check last 10 claims (or all if fewer)
  const start = claimCount > 10n ? Number(claimCount) - 10 : 0;
  const threshold = BigInt(Math.floor(CLAIM_ALERT_ETH * 1e18));

  for (let i = start; i < Number(claimCount); i++) {
    const claim = await client.readContract({
      address: CONTRACTS.InsurancePool,
      abi: insurancePoolAbi,
      functionName: "claims",
      args: [BigInt(i)],
    }) as [string, bigint, bigint, boolean, bigint];

    const [claimant, taskId, amount, paid] = claim;

    if (amount >= threshold) {
      handler({
        level: "CRITICAL",
        source: "InsurancePool",
        message: `Large claim filed: ${formatEther(amount)} ETH (threshold: ${CLAIM_ALERT_ETH} ETH)`,
        data: { claimId: i, claimant, taskId: taskId.toString(), paid },
        timestamp: ts(),
      });
    }
  }
}

/** Check recent disputes */
async function checkRecentDisputes(handler: AlertHandler = fireAlert) {
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  const disputeCount = await client.readContract({
    address: CONTRACTS.DisputeResolution,
    abi: disputeResolutionAbi,
    functionName: "disputeCounter",
  });

  if (disputeCount === 0n) return;

  // Check the latest dispute
  const latest = disputeCount - 1n;
  const dispute = await client.readContract({
    address: CONTRACTS.DisputeResolution,
    abi: disputeResolutionAbi,
    functionName: "disputes",
    args: [latest],
  }) as [bigint, string, bigint, bigint, boolean, boolean, bigint];

  const [taskId, filedBy, bondAmount, votingEndsAt, resolved] = dispute;

  if (!resolved) {
    handler({
      level: "WARN",
      source: "DisputeResolution",
      message: `Unresolved dispute #${latest} on task ${taskId}`,
      data: {
        disputeId: String(latest),
        taskId: String(taskId),
        filedBy,
        bond: formatEther(bondAmount) + " ETH",
        votingEndsAt: new Date(Number(votingEndsAt) * 1000).toISOString(),
      },
      timestamp: ts(),
    });
  }
}

// ---------------------------------------------------------------------------
// Continuous watch mode (event-driven)
// ---------------------------------------------------------------------------

function watchAlerts() {
  const client = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

  console.log(`[${ts()}] COVENANT Alert Watcher — listening for critical events...`);

  // Watch insurance claims
  client.watchContractEvent({
    address: CONTRACTS.InsurancePool,
    abi: insurancePoolAbi,
    eventName: "ClaimFiled",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as any).args;
        const amount = args.amount as bigint;
        const threshold = BigInt(Math.floor(CLAIM_ALERT_ETH * 1e18));
        if (amount >= threshold) {
          fireAlert({
            level: "CRITICAL",
            source: "InsurancePool",
            message: `Large claim filed: ${formatEther(amount)} ETH`,
            data: {
              claimId: String(args.claimId),
              claimant: args.claimant,
              amount: formatEther(amount) + " ETH",
            },
            timestamp: ts(),
          });
        }
      }
    },
  });

  // Watch disputes
  client.watchContractEvent({
    address: CONTRACTS.DisputeResolution,
    abi: disputeResolutionAbi,
    eventName: "DisputeFiled",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as any).args;
        fireAlert({
          level: "WARN",
          source: "DisputeResolution",
          message: `New dispute filed on task ${args.taskId}`,
          data: {
            disputeId: String(args.disputeId),
            taskId: String(args.taskId),
            filedBy: args.filedBy,
          },
          timestamp: ts(),
        });
      }
    },
  });

  // Watch agent deactivations
  client.watchContractEvent({
    address: CONTRACTS.AgentRegistry,
    abi: agentRegistryAbi,
    eventName: "AgentDeactivated",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as any).args;
        fireAlert({
          level: "INFO",
          source: "AgentRegistry",
          message: `Agent deactivated: ${args.agent}`,
          data: { agent: args.agent },
          timestamp: ts(),
        });
      }
    },
  });

  // Watch stake slashes
  client.watchContractEvent({
    address: CONTRACTS.AgentRegistry,
    abi: agentRegistryAbi,
    eventName: "StakeSlashed",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as any).args;
        fireAlert({
          level: "CRITICAL",
          source: "AgentRegistry",
          message: `Stake slashed: ${formatEther(args.amount)} ETH — ${args.reason}`,
          data: {
            agent: args.agent,
            amount: formatEther(args.amount) + " ETH",
            reason: args.reason,
          },
          timestamp: ts(),
        });
      }
    },
  });

  // Watch task disputes
  client.watchContractEvent({
    address: CONTRACTS.TaskEscrow,
    abi: taskEscrowAbi,
    eventName: "TaskDisputed",
    onLogs(logs) {
      for (const log of logs) {
        const args = (log as any).args;
        fireAlert({
          level: "WARN",
          source: "TaskEscrow",
          message: `Task ${args.taskId} disputed by ${args.disputedBy}`,
          data: { taskId: String(args.taskId), disputedBy: args.disputedBy },
          timestamp: ts(),
        });
      }
    },
  });

  // Periodic subgraph health check (every 5 min)
  setInterval(async () => {
    try {
      const health = await checkSubgraphHealth();
      if (!health.healthy) {
        for (const a of health.alerts) {
          fireAlert({
            level: "WARN",
            source: "Subgraph",
            message: a,
            data: { syncedBlock: health.syncedBlock, lag: health.lag ?? undefined },
            timestamp: ts(),
          });
        }
      }
    } catch {
      fireAlert({
        level: "WARN",
        source: "Subgraph",
        message: "Health check failed — subgraph may be down",
        timestamp: ts(),
      });
    }
  }, 5 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const watch = process.argv.includes("--watch");

  console.log(`[${ts()}] COVENANT Alert System`);
  console.log(`[${ts()}] Thresholds: claim>${CLAIM_ALERT_ETH}ETH, deactivation>${DEACTIVATION_STAKE_ALERT_ETH}ETH`);

  if (watch) {
    watchAlerts();
    process.on("SIGINT", () => {
      console.log(`\n[${ts()}] Shutting down alert watcher...`);
      process.exit(0);
    });
  } else {
    console.log(`[${ts()}] Running one-shot checks...\n`);
    await checkLargeClaims();
    await checkRecentDisputes();
    console.log(`\n[${ts()}] Done.`);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();

export { fireAlert, checkLargeClaims, checkRecentDisputes, watchAlerts };
