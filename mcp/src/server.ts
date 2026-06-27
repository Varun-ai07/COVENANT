/**
 * COVENANT MCP Server — 23 consolidated domain tools.
 *
 * Each tool is a domain router with an `action` parameter.
 * One tool per concept instead of 131 individual tools.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { info } from "./logger.js";

// Consolidated domain tools
import { registerAgentTools } from "./tools/corven-agent.js";
import { registerTaskTools } from "./tools/corven-task.js";
import { registerMarketTools } from "./tools/corven-market.js";
import { registerBatchTools } from "./tools/corven-batch.js";
import { registerCollectiveTools } from "./tools/corven-collective.js";
import { registerInsuranceTools } from "./tools/corven-insurance.js";
import { registerDisputeTools } from "./tools/disputes.js";
import { registerAttestTools } from "./tools/corven-attest.js";
import { registerStreamTools } from "./tools/corven-stream.js";
import { registerWalletTools } from "./tools/corven-wallet.js";
import { registerTrainingTools } from "./tools/corven-training.js";
import { registerGrantTools } from "./tools/corven-grants.js";
import { registerGovernTools } from "./tools/corven-govern.js";
import { registerBountyTools } from "./tools/corven-bounty.js";
import { registerMessageTools } from "./tools/corven-message.js";
import { registerRevisionTools } from "./tools/corven-revision.js";
import { registerReputationTools } from "./tools/corven-reputation.js";
import { registerVerifyTools } from "./tools/corven-verify.js";
import { registerMatchTools } from "./tools/corven-match.js";
import { registerRouterTools } from "./tools/corven-router.js";
import { registerStatsTools } from "./tools/corven-stats.js";
import { registerFiatTools } from "./tools/corven-fiat.js";
import { registerMultiTools } from "./tools/corven-multi.js";
import { registerIPFSUploadTool } from "./tools/corven-ipfs.js";
import { registerStatusTool } from "./tools/corven-status.js";
import { registerVersionTools } from "./tools/corven-version.js";
import { registerEncryptTools } from "./tools/corven-encrypt.js";

// Legacy tools (kept during migration)
import { registerCovenantHelpTools } from "./tools/covenant-help.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "covenant-mcp",
    version: "3.0.1",
  });

  // ── Core Identity ─────────────────────────────────────────────
  registerAgentTools(server);        // corven_agent: register, get, update, deactivate, stake, find

  // ── Task Lifecycle ────────────────────────────────────────────
  registerTaskTools(server);         // corven_task: create, fund, submit, verify, dispute, get
  registerMarketTools(server);       // corven_market: post, bid, select, cancel, get, list
  registerBatchTools(server);        // corven_batch: create, submit, verify, get, check
  registerCollectiveTools(server);   // corven_collective: create, join, launch, propose, get

  // ── Protection & Resolution ───────────────────────────────────
  registerInsuranceTools(server);    // corven_insurance: join, premium, claim, vote, get
  registerDisputeTools(server);      // corven_dispute: file, vote, get, claim_reward

  // ── Verification & Reputation ─────────────────────────────────
  registerAttestTools(server);       // corven_attest: create, verify, batch, get
  registerReputationTools(server);   // corven_reputation: export, import, did
  registerVerifyTools(server);       // corven_verify: deep, capability, reputation, result

  // ── Payments ──────────────────────────────────────────────────
  registerStreamTools(server);       // corven_stream: create, withdraw, cancel, get
  registerWalletTools(server);       // corven_wallet: create, get, limit, recipient, pause
  registerMultiTools(server);        // corven_multi: create, submit, verify, get, tokens

  // ── Ecosystem ─────────────────────────────────────────────────
  registerTrainingTools(server);     // corven_training: create, enroll, complete, list, get
  registerGrantTools(server);        // corven_grants: apply, vote, list, get
  registerGovernTools(server);       // corven_govern: create, vote, list, get
  registerBountyTools(server);       // corven_bounty: post, claim, winner, list, get

  // ── Coordination ──────────────────────────────────────────────
  registerMessageTools(server);      // corven_message: send, list, unread
  registerRevisionTools(server);     // corven_revision: request, submit, get, check
  registerMatchTools(server);        // corven_match: find, match

  // ── Infrastructure ────────────────────────────────────────────
  registerRouterTools(server);       // corven_router: multicall, quickstart
  registerStatsTools(server);        // corven_stats: stats, leaderboard
  registerFiatTools(server);         // corven_fiat: url, providers
  registerIPFSUploadTool(server);    // corven_upload_ipfs: upload to IPFS

  // ── Status ────────────────────────────────────────────────────
  registerStatusTool(server);        // corven_status: system status dashboard

  // ── Versioning & Encryption ───────────────────────────────────
  registerVersionTools(server);      // corven_version: track, history, diff deliverable versions
  registerEncryptTools(server);      // corven_encrypt: encrypt, decrypt task content

  // ── Help ──────────────────────────────────────────────────────
  registerCovenantHelpTools(server); // corven_help: protocol guide

  info("[SERVER] 28 corven_ domain tools registered");
  return server;
}
