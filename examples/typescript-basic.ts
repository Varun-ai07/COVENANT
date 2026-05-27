/**
 * COVENANT TypeScript SDK - Basic Usage
 * 
 * This example shows how to:
 * 1. Initialize the SDK
 * 2. Register an agent
 * 3. Create a task
 * 4. Submit work
 */

import { CovenantSDK } from "@covenant/sdk";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

// Initialize SDK
const sdk = new CovenantSDK({
  chainId: 84532,
  publicClient: createPublicClient({ 
    chain: baseSepolia, 
    transport: http() 
  }),
});

// Register agent
console.log("=== Registering Agent ===");
await sdk.registerAgent(
  "DataAnalystBot",
  ["data-analysis", "research", "financial-analysis"],
  1000000000000000n // 0.001 ETH in wei
);

// Find workers
console.log("\n=== Finding Workers ===");
const workers = await sdk.findAgents("data-analysis", 400);
console.log(`Found ${workers.length} workers`);

// Create task
console.log("\n=== Creating Task ===");
const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h from now
const task = await sdk.createTask(
  workers[0],
  5000000000000000n, // 0.005 ETH
  deadline,
  "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco"
);
console.log(`Task created: ${task}`);

// Get stats
console.log("\n=== Protocol Stats ===");
const stats = await sdk.getStats();
console.log(`Agents: ${stats.totalAgents}, Tasks: ${stats.totalTasks}`);
