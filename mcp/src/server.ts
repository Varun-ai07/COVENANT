/**
 * COVENANT MCP Server — tool registration hub.
 *
 * V4 architecture: 6 core on-chain contracts + offchain services.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAgentTools } from "./tools/registry.js";
import { registerEscrowTools } from "./tools/escrow.js";
import { registerReceiptTools } from "./tools/receipts.js";
import { registerProtocolTools } from "./tools/protocol.js";
import { registerDisputeTools } from "./tools/disputes.js";
import { registerVerificationTools } from "./tools/verification.js";
import { registerMultiTokenTools } from "./tools/multi-token.js";
import { registerReputationVCTools } from "./tools/reputation-vc.js";
import { registerCovenantHelpTools } from "./tools/covenant-help.js";
import { registerStreamingTools } from "./tools/streaming.js";
import { registerGovernanceTools } from "./tools/governance.js";
import { registerBountyTools } from "./tools/bounties.js";
import { registerMessagingTools } from "./tools/messaging.js";
import { registerCrossChainTools } from "./tools/cross-chain.js";
import { registerMatchingTools } from "./tools/matching.js";
import { registerOffchainCoordinatorTools } from "./tools/offchain-coordinator.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerVerifyDeepTools } from "./tools/verify-deep.js";
import { registerFiatOnrampTools } from "./tools/fiat-onramp.js";
import { registerBridgeTools } from "./tools/bridge.js";
import { info, warn } from "./logger.js";

// V4-removed tools (insurance, market, batches, collectives, router, AA, grants, training, revisions)
// These are imported but wrapped in try/catch so missing contracts don't crash the server.

export function createServer(): McpServer {
  const server = new McpServer({
    name: "covenant-mcp",
    version: "2.0.0",
  });

  // ─── V4 Core (on-chain) ───────────────────────────────────────
  registerAgentTools(server);        // CovenantIdentity
  registerEscrowTools(server);       // CovenantEscrow
  registerReceiptTools(server);      // CovenantAttestation (receipts)
  registerProtocolTools(server);     // Protocol stats (reads)
  registerDisputeTools(server);      // CovenantArbitration
  registerVerificationTools(server); // CovenantAttestation (attestations)
  registerMultiTokenTools(server);   // CovenantSettlement (streams)
  registerReputationVCTools(server); // DID + VCs (off-chain)

  // ─── Offchain services (in-memory / off-chain) ───────────────
  registerCovenantHelpTools(server);
  registerTemplateTools(server);
  registerMatchingTools(server);
  registerOffchainCoordinatorTools(server);
  registerMessagingTools(server);
  registerFiatOnrampTools(server);
  registerCrossChainTools(server);
  registerStreamingTools(server);
  registerGovernanceTools(server);
  registerBountyTools(server);
  registerBridgeTools(server);
  registerVerifyDeepTools(server);

  // ─── Deprecated (V1/V2 only, gracefully skipped) ─────────────
  const deprecated: Array<{ name: string; fn: (s: McpServer) => void }> = [
    { name: "market", fn: (s) => { const m = require("./tools/market.js"); m.registerMarketTools(s); } },
    { name: "batches", fn: (s) => { const m = require("./tools/batches.js"); m.registerBatchTools(s); } },
    { name: "collectives", fn: (s) => { const m = require("./tools/collectives.js"); m.registerCollectiveTools(s); } },
    { name: "insurance", fn: (s) => { const m = require("./tools/insurance.js"); m.registerInsuranceTools(s); } },
    { name: "router", fn: (s) => { const m = require("./tools/router.js"); m.registerRouterTools(s); } },
    { name: "grants", fn: (s) => { const m = require("./tools/grants.js"); m.registerGrantTools(s); } },
    { name: "training", fn: (s) => { const m = require("./tools/training.js"); m.registerTrainingTools(s); } },
    { name: "revisions", fn: (s) => { const m = require("./tools/revisions.js"); m.registerRevisionTools(s); } },
    { name: "account-abstraction", fn: (s) => { const m = require("./tools/account-abstraction.js"); m.registerAATools(s); } },
  ];

  for (const d of deprecated) {
    try {
      d.fn(server);
    } catch (e: any) {
      warn(`[SERVER] Deprecated tool "${d.name}" skipped: ${e.message?.slice(0, 80)}`);
    }
  }

  info("[SERVER] corven_ MCP tools registered (V4 core + offchain services)");
  return server;
}
