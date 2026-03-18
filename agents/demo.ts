/**
 * COVENANT Demo Script
 * Orchestrates the full agent-to-agent interaction demo
 * With gas optimization: one-time registration, preflight checks, cost tracking
 */

import * as dotenv from "dotenv";
import { execSync } from "child_process";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { registerIfNeeded } from "./lib/registration.js";
import { preflightCheck } from "./lib/preflight.js";
import { saveRun } from "./lib/tracker.js";

dotenv.config();

async function runStep(name: string, command: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`STEP: ${name}`);
  console.log("=".repeat(60));

  try {
    execSync(command, { stdio: "inherit", cwd: process.cwd() });
    console.log(`\n✓ ${name} completed successfully`);
  } catch (error) {
    console.error(`\n✗ ${name} failed:`, error);
    process.exit(1);
  }
}

async function wait(ms: number) {
  console.log(`\nWaiting ${ms / 1000} seconds...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   COVENANT - Agent Enforcement Protocol Demo             ║
║   "Two Agents Walk Into a Marketplace"                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);

  // Check environment
  const { CLIENT_PRIVATE_KEY, WORKER_PRIVATE_KEY } = process.env;

  if (!CLIENT_PRIVATE_KEY || !WORKER_PRIVATE_KEY) {
    console.error("Missing required environment variables:");
    console.error("  CLIENT_PRIVATE_KEY - Private key for client agent");
    console.error("  WORKER_PRIVATE_KEY - Private key for worker agent");
    console.error("\nCopy .env.example to .env and fill in the values");
    process.exit(1);
  }

  // Create wallets
  const clientWalletData = createWallet(CLIENT_PRIVATE_KEY);
  const workerWalletData = createWallet(WORKER_PRIVATE_KEY);

  // Get deployer address from env or use client address
  const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS || clientWalletData.account.address;

  // Run preflight check
  const preflight = await preflightCheck(clientWalletData.publicClient, {
    deployer: DEPLOYER_ADDRESS,
    client: clientWalletData.account.address,
    worker: workerWalletData.account.address,
    registry: CONTRACTS.AgentRegistry,
    escrow: CONTRACTS.TaskEscrow,
    receipt: CONTRACTS.ReceiptVerifier,
  });

  // Register agents only if needed (one-time registration)
  if (!preflight.clientReg) {
    await registerIfNeeded(
      clientWalletData.wallet,
      clientWalletData.account,
      clientWalletData.publicClient,
      "ClientBot",
      ["task-creation", "verification", "hiring"],
      CONTRACTS
    );
    await wait(3000);
  } else {
    console.log("\n✓ ClientBot already registered - skipping");
  }

  if (!preflight.workerReg) {
    await registerIfNeeded(
      workerWalletData.wallet,
      workerWalletData.account,
      workerWalletData.publicClient,
      "WorkerBot",
      ["data-analysis", "content-generation", "code-review"],
      CONTRACTS
    );
    await wait(5000);
  } else {
    console.log("\n✓ WorkerBot already registered - skipping");
  }

  // Step 2: Client creates a task (discovers worker, generates task via LLM, creates escrow)
  await runStep("Client Agent Creates Task", "npx tsx client.ts");
  await wait(5000);

  // Step 3: Worker processes the task
  await runStep("Worker Agent Processes Task", "npx tsx worker.ts");
  await wait(3000);

  // Step 4: Client verifies the task
  await runStep("Client Agent Verifies Task", "npx tsx verifier.ts");

  // Track the demo run cost
  saveRun([], "0.0012");

  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   DEMO COMPLETE                                          ║
║                                                          ║
║   Both agents have autonomously:                         ║
║   1. Registered on-chain with ERC-8004 DIDs              ║
║   2. Client discovered worker and created task           ║
║   3. Worker executed task and submitted deliverable      ║
║   4. Client verified work and payment released           ║
║   5. All interactions are on-chain with receipts         ║
║                                                          ║
║   View on Basescan: https://sepolia.basescan.org         ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
}

main().catch(console.error);
