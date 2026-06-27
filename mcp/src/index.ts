#!/usr/bin/env node
/**
 * COVENANT MCP Server — entry point.
 *
 * Usage:
 *   node dist/index.js --stdio          # stdio transport (for Claude Code, Cursor, etc.)
 *   node dist/index.js --http           # HTTP transport (for remote clients)
 *   node dist/index.js                  # defaults to stdio
 *   MCP_HTTP_PORT=3001 node dist/index.js --http  # custom HTTP port
 *
 * Security:
 *   - HTTP mode requires MCP_API_KEY env var for authentication
 *   - stdio mode is for trusted local use (same-machine CLI)
 *   - Set PRIVATE_KEY env var for autonomous transaction signing
 */
import { createServer } from "./server.js";
import { createStdioTransport } from "./transports/stdio.js";
import { startHttpServer } from "./transports/http.js";
import { HTTP_PORT, validateConfig } from "./config.js";
import { AutoVerifier } from "./auto-verifier.js";
import { eventWatcher } from "./lib/event-watcher.js";

let autoVerifier: AutoVerifier | null = null;

async function main(): Promise<void> {
  validateConfig();

  const args = process.argv.slice(2);
  const useHttp = args.includes("--http");
  const useStdio = args.includes("--stdio") || !useHttp;
  const noAutoVerify = args.includes("--no-auto-verify");

  if (useHttp && useStdio) {
    console.error("[ERROR] Cannot use both --stdio and --http. Pick one.");
    process.exit(1);
  }

  if (useHttp) {
    console.error("[BOOT] Starting COVENANT MCP Server in HTTP mode...");
    await startHttpServer(() => createServer(), HTTP_PORT);
    console.error("[BOOT] Server is ready. POST to /mcp to interact.");
  } else {
    console.error("[BOOT] Starting COVENANT MCP Server in stdio mode...");
    const server = createServer();
    const transport = createStdioTransport();
    await server.connect(transport);
    console.error("[BOOT] Server is ready. Waiting for MCP messages on stdin...");
  }

  // Start auto-verifier in background (unless disabled)
  if (!noAutoVerify) {
    autoVerifier = new AutoVerifier({
      rpcUrl: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      privateKey: process.env.PRIVATE_KEY || undefined,
      pollIntervalMs: 15000,
      maxConcurrent: 3,
    });
    autoVerifier.start().catch((e) => {
      console.error("[AutoVerifier] Failed to start:", e);
    });
  }

  // Graceful shutdown — stop auto-verifier, clean temp dirs
  const shutdown = () => {
    console.error("[BOOT] Shutting down...");
    if (autoVerifier) autoVerifier.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
