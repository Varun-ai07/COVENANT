/**
 * Protocol metrics collector — periodically queries on-chain contracts
 * and subgraph for aggregate COVENANT protocol statistics.
 *
 * Usage:
 *   tsx src/metrics-collector.ts              # one-shot
 *   tsx src/metrics-collector.ts --loop       # poll every METRICS_INTERVAL_MS
 */

import { createPublicClient, http, formatEther } from "viem";
import { baseSepolia } from "viem/chains";
import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client";
import {
  CONTRACTS, RPC_URL, SUBGRAPH_URL, METRICS_INTERVAL_MS, ts,
} from "./config.js";
import {
  agentRegistryAbi,
  taskEscrowAbi,
  receiptVerifierAbi,
  insurancePoolAbi,
  disputeResolutionAbi,
} from "./abis.js";

// ---------------------------------------------------------------------------
// Subgraph queries
// ---------------------------------------------------------------------------

const METRICS_QUERY = gql`
  query ProtocolMetrics {
    # Agents
    agents(first: 1000, where: { isActive: true }) {
      id
      stakedAmount
    }

    # Tasks by status
    taskCreateds: tasks(where: { status: "Created" }) { id }
    taskFundeds: tasks(where: { status: "Funded" }) { id }
    taskInProgress: tasks(where: { status: "InProgress" }) { id }
    submitteds: tasks(where: { status: "Submitted" }) { id }
    completeds: tasks(where: { status: "Completed" }) { id }
    faileds: tasks(where: { status: "Failed" }) { id }
    disputed: tasks(where: { status: "Disputed" }) { id }

    # Recent activity (last 24h — filter by timestamp in handler)
    recentTaskCreateds: taskCreateds(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      taskId
      client
      worker
      payment
      blockTimestamp
    }

    recentTaskCompleteds: taskCompleteds(
      first: 100
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      taskId
      workerPayment
      blockTimestamp
    }

    # Disputes
    disputeFileds(first: 100, orderBy: blockTimestamp, orderDirection: desc) {
      id
      disputeId
      taskId
      filedBy
      blockTimestamp
    }

    # Insurance
    claimFileds(first: 100, orderBy: blockTimestamp, orderDirection: desc) {
      id
      claimId
      claimant
      amount
      blockTimestamp
    }
    claimPaids(first: 100, orderBy: blockTimestamp, orderDirection: desc) {
      id
      claimId
      amount
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProtocolMetrics {
  // Registry
  totalAgents: bigint;
  // Escrow
  totalTasks: bigint;
  accumulatedFees: bigint;
  // Receipts
  totalReceipts: bigint;
  // Insurance
  poolBalance: bigint;
  memberCount: bigint;
  claimCount: bigint;
  // Disputes
  disputeCount: bigint;
  // Derived
  tasksByStatus: Record<string, number>;
  recent24h: {
    newTasks: number;
    completedTasks: number;
    newDisputes: number;
    newClaims: number;
  };
  collectedAt: string;
}

// ---------------------------------------------------------------------------
// On-chain metrics (always available, no subgraph dependency)
// ---------------------------------------------------------------------------

export async function collectOnChainMetrics(): Promise<ProtocolMetrics> {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const [
    totalAgents,
    totalTasks,
    accumulatedFees,
    totalReceipts,
    poolBalance,
    memberCount,
    claimCount,
    disputeCount,
  ] = await Promise.all([
    client.readContract({
      address: CONTRACTS.AgentRegistry,
      abi: agentRegistryAbi,
      functionName: "agentCount",
    }),
    client.readContract({
      address: CONTRACTS.TaskEscrow,
      abi: taskEscrowAbi,
      functionName: "taskCounter",
    }),
    client.readContract({
      address: CONTRACTS.TaskEscrow,
      abi: taskEscrowAbi,
      functionName: "accumulatedFees",
    }),
    client.readContract({
      address: CONTRACTS.ReceiptVerifier,
      abi: receiptVerifierAbi,
      functionName: "receiptCount",
    }),
    client.readContract({
      address: CONTRACTS.InsurancePool,
      abi: insurancePoolAbi,
      functionName: "totalPoolBalance",
    }),
    client.readContract({
      address: CONTRACTS.InsurancePool,
      abi: insurancePoolAbi,
      functionName: "memberCount",
    }),
    client.readContract({
      address: CONTRACTS.InsurancePool,
      abi: insurancePoolAbi,
      functionName: "claimCounter",
    }),
    client.readContract({
      address: CONTRACTS.DisputeResolution,
      abi: disputeResolutionAbi,
      functionName: "disputeCounter",
    }),
  ]);

  return {
    totalAgents: totalAgents as bigint,
    totalTasks: totalTasks as bigint,
    accumulatedFees: accumulatedFees as bigint,
    totalReceipts: totalReceipts as bigint,
    poolBalance: poolBalance as bigint,
    memberCount: memberCount as bigint,
    claimCount: claimCount as bigint,
    disputeCount: disputeCount as bigint,
    tasksByStatus: {}, // populated by subgraph
    recent24h: { newTasks: 0, completedTasks: 0, newDisputes: 0, newClaims: 0 },
    collectedAt: ts(),
  };
}

// ---------------------------------------------------------------------------
// Subgraph-enriched metrics (best effort)
// ---------------------------------------------------------------------------

export async function collectSubgraphMetrics(): Promise<Partial<ProtocolMetrics>> {
  const client = new ApolloClient({
    link: new HttpLink({ uri: SUBGRAPH_URL, fetch }),
    cache: new InMemoryCache(),
    defaultOptions: { query: { fetchPolicy: "network-only" } },
  });

  try {
    const { data } = await client.query({ query: METRICS_QUERY });

    const now24hAgo = Math.floor(Date.now() / 1000) - 86400;

    const recentNew = (data.recentTaskCreateds ?? []).filter(
      (t: any) => Number(t.blockTimestamp) > now24hAgo,
    ).length;
    const recentCompleted = (data.recentTaskCompleteds ?? []).filter(
      (t: any) => Number(t.blockTimestamp) > now24hAgo,
    ).length;
    const recentDisputes = (data.disputeFileds ?? []).filter(
      (d: any) => Number(d.blockTimestamp) > now24hAgo,
    ).length;
    const recentClaims = (data.claimFileds ?? []).filter(
      (c: any) => Number(c.blockTimestamp) > now24hAgo,
    ).length;

    return {
      tasksByStatus: {
        Created: (data.taskCreateds ?? []).length,
        Funded: (data.taskFundeds ?? []).length,
        InProgress: (data.taskInProgress ?? []).length,
        Submitted: (data.submitteds ?? []).length,
        Completed: (data.completeds ?? []).length,
        Failed: (data.faileds ?? []).length,
        Disputed: (data.disputed ?? []).length,
      },
      recent24h: {
        newTasks: recentNew,
        completedTasks: recentCompleted,
        newDisputes: recentDisputes,
        newClaims: recentClaims,
      },
    };
  } catch (err) {
    console.error(`[${ts()}] Subgraph query failed (using on-chain only):`, (err as Error).message);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Combined collector
// ---------------------------------------------------------------------------

export async function collectAllMetrics(): Promise<ProtocolMetrics> {
  const [onChain, subgraph] = await Promise.all([
    collectOnChainMetrics(),
    collectSubgraphMetrics(),
  ]);

  return { ...onChain, ...subgraph } as ProtocolMetrics;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function displayMetrics(m: ProtocolMetrics) {
  console.log("\n" + "═".repeat(60));
  console.log(`  COVENANT Protocol Metrics — ${m.collectedAt}`);
  console.log("═".repeat(60));
  console.log(`  Agents Registered     : ${m.totalAgents}`);
  console.log(`  Tasks Created         : ${m.totalTasks}`);
  console.log(`  Accumulated Fees      : ${formatEther(m.accumulatedFees)} ETH`);
  console.log(`  Receipts Issued       : ${m.totalReceipts}`);
  console.log(`  Insurance Pool Balance: ${formatEther(m.poolBalance)} ETH`);
  console.log(`  Insurance Members     : ${m.memberCount}`);
  console.log(`  Insurance Claims      : ${m.claimCount}`);
  console.log(`  Disputes Filed        : ${m.disputeCount}`);

  if (Object.keys(m.tasksByStatus).length > 0) {
    console.log("\n  Tasks by Status:");
    for (const [status, count] of Object.entries(m.tasksByStatus)) {
      console.log(`    ${status.padEnd(12)} : ${count}`);
    }
  }

  console.log("\n  Last 24 Hours:");
  console.log(`    New tasks      : ${m.recent24h.newTasks}`);
  console.log(`    Completed      : ${m.recent24h.completedTasks}`);
  console.log(`    New disputes   : ${m.recent24h.newDisputes}`);
  console.log(`    New claims     : ${m.recent24h.newClaims}`);
  console.log("═".repeat(60) + "\n");
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------

async function main() {
  const loop = process.argv.includes("--loop");

  console.log(`[${ts()}] COVENANT Metrics Collector`);
  console.log(`[${ts()}] RPC: ${RPC_URL}`);

  if (loop) {
    console.log(`[${ts()}] Polling every ${METRICS_INTERVAL_MS / 1000}s\n`);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        const metrics = await collectAllMetrics();
        displayMetrics(metrics);
      } catch (err) {
        console.error(`[${ts()}] Collection error:`, err);
      }
      await new Promise((r) => setTimeout(r, METRICS_INTERVAL_MS));
    }
  } else {
    const metrics = await collectAllMetrics();
    displayMetrics(metrics);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();

export { main as runMetricsCollector };
