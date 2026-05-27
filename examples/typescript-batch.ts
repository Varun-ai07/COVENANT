/**
 * COVENANT TypeScript SDK - Batch Operations
 */

import { CovenantSDK } from "@covenant/sdk";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const sdk = new CovenantSDK({
  chainId: 84532,
  publicClient: createPublicClient({ chain: baseSepolia, transport: http() }),
});

// Create batch
console.log("=== Creating Batch ===");
const workers = [
  "0xWorker1...",
  "0xWorker2...",
  "0xWorker3...",
];
const payments = [
  1000000000000000n, // 0.001 ETH
  1000000000000000n,
  1000000000000000n,
];
const deadlines = Array(3).fill(BigInt(Math.floor(Date.now() / 1000) + 86400));
const hashes = ["QmHash1...", "QmHash2...", "QmHash3..."];

const batch = await sdk.createBatch(workers, payments, deadlines, hashes);
console.log(`Batch created: ${batch}`);

// Check batch status
const status = await sdk.getBatch(batch);
console.log(`Batch status: ${status}`);

// Aggregate results
const result = await sdk.aggregateResults(batch);
console.log(`Aggregated: ${result}`);
