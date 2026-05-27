/**
 * Subgraph health checker — queries The Graph _meta endpoint
 * for sync status, block number, and health.
 */

import { ApolloClient, InMemoryCache, gql, HttpLink } from "@apollo/client";
import { SUBGRAPH_URL, SYNC_LAG_ALERT_BLOCKS, ts } from "./config.js";

// ---------------------------------------------------------------------------
// GraphQL queries
// ---------------------------------------------------------------------------

const META_QUERY = gql`
  query SubgraphMeta {
    _meta {
      block {
        number
        hash
      }
      deployment
      hasIndexingErrors
    }
  }
`;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubgraphMeta {
  block: { number: number; hash: string };
  deployment: string;
  hasIndexingErrors: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  syncedBlock: number;
  chainBlock: number | null;
  lag: number | null;
  hasIndexingErrors: boolean;
  deployment: string;
  latencyMs: number;
  checkedAt: string;
  alerts: string[];
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createSubgraphClient(url: string = SUBGRAPH_URL) {
  return new ApolloClient({
    link: new HttpLink({ uri: url, fetch }),
    cache: new InMemoryCache(),
    defaultOptions: { query: { fetchPolicy: "network-only" } },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch subgraph _meta and assess health.
 * @param chainHeadBlock — latest block from RPC (optional; enables lag calc)
 */
export async function checkSubgraphHealth(
  chainHeadBlock?: number,
  url?: string,
): Promise<HealthStatus> {
  const client = createSubgraphClient(url);
  const start = Date.now();

  const { data } = await client.query<{ _meta: SubgraphMeta }>({
    query: META_QUERY,
  });
  const latencyMs = Date.now() - start;

  const meta = data._meta;
  const lag = chainHeadBlock != null ? chainHeadBlock - meta.block.number : null;

  const alerts: string[] = [];
  if (meta.hasIndexingErrors) alerts.push("INDEXING_ERRORS");
  if (lag != null && lag > SYNC_LAG_ALERT_BLOCKS) {
    alerts.push(`SYNC_LAG_${lag}_BLOCKS`);
  }

  return {
    healthy: alerts.length === 0,
    syncedBlock: meta.block.number,
    chainBlock: chainHeadBlock ?? null,
    lag,
    hasIndexingErrors: meta.hasIndexingErrors,
    deployment: meta.deployment,
    latencyMs,
    checkedAt: ts(),
    alerts,
  };
}

// ---------------------------------------------------------------------------
// CLI entry-point
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[${ts()}] Checking subgraph health...`);

  try {
    const status = await checkSubgraphHealth();
    console.log(JSON.stringify(status, null, 2));

    if (!status.healthy) {
      console.error(`[${ts()}] ALERTS: ${status.alerts.join(", ")}`);
      process.exitCode = 1;
    }
  } catch (err) {
    console.error(`[${ts()}] Subgraph health check failed:`, err);
    process.exitCode = 1;
  }
}

// Run when executed directly
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main();

export { main as runSubgraphHealthCheck };
