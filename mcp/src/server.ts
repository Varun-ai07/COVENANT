/**
 * COVENANT MCP Server — tool registration hub.
 *
 * 12 files, ~70 tools. Settlement onchain, coordination offchain.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAgentTools } from "./tools/registry.js";
import { registerEscrowTools } from "./tools/escrow.js";
import { registerReceiptTools } from "./tools/receipts.js";
import { registerProtocolTools } from "./tools/protocol.js";
import { registerMarketTools } from "./tools/market.js";
import { registerBatchTools } from "./tools/batches.js";
import { registerCollectiveTools } from "./tools/collectives.js";
import { registerDisputeTools } from "./tools/disputes.js";
import { registerInsuranceTools } from "./tools/insurance.js";
import { registerVerificationTools } from "./tools/verification.js";
import { registerRouterTools } from "./tools/router.js";
import { registerOffchainCoordinatorTools } from "./tools/offchain-coordinator.js";
import { registerMultiTokenTools } from "./tools/multi-token.js";
import { registerReputationVCTools } from "./tools/reputation-vc.js";
import { registerCovenantHelpTools } from "./tools/covenant-help.js";
import { registerAATools } from "./tools/account-abstraction.js";
import { registerFiatOnrampTools } from "./tools/fiat-onramp.js";
import { registerTemplateTools } from "./tools/templates.js";
import { registerMatchingTools } from "./tools/matching.js";
import { registerMessagingTools } from "./tools/messaging.js";
import { registerCrossChainTools } from "./tools/cross-chain.js";
import { registerStreamingTools } from "./tools/streaming.js";
import { registerGovernanceTools } from "./tools/governance.js";
import { registerBountyTools } from "./tools/bounties.js";
import { registerBridgeTools } from "./tools/bridge.js";
import { registerGrantTools } from "./tools/grants.js";
import { registerTrainingTools } from "./tools/training.js";
import { registerVerifyDeepTools } from "./tools/verify-deep.js";
import { registerRevisionTools } from "./tools/revisions.js";
import { info } from "./logger.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "covenant-mcp",
    version: "1.0.0",
  });

  // Settlement layer (onchain)
  registerAgentTools(server);       // AgentRegistry
  registerEscrowTools(server);      // TaskEscrow
  registerReceiptTools(server);     // ReceiptVerifier
  registerProtocolTools(server);    // Protocol stats
  registerMarketTools(server);      // OpenTaskMarket
  registerBatchTools(server);       // ParallelTaskBatch
  registerCollectiveTools(server);  // AgentCollective
  registerDisputeTools(server);     // DisputeArbitration
  registerInsuranceTools(server);   // AgentInsurance
  registerVerificationTools(server);// ZK + ERC-8004
  registerRouterTools(server);      // COVENANTRouter
  registerMultiTokenTools(server);  // MultiTokenEscrow
  registerReputationVCTools(server); // Reputation VCs + DID
  registerAATools(server);           // Account Abstraction (Smart Wallet + Paymaster)

  // Meta & coordination tools (offchain)
  registerCovenantHelpTools(server); // Protocol guide + workflow sequences
  registerTemplateTools(server);     // Task templates with auto-pricing
  registerMatchingTools(server);     // Smart worker matching (multi-factor scoring)
  registerOffchainCoordinatorTools(server); // Profiles, matching, templates, marketplace
  registerMessagingTools(server);         // Agent messaging (in-memory MVP)
  registerFiatOnrampTools(server);        // Fiat on-ramp URLs (MoonPay/Transak)
  registerCrossChainTools(server);        // Cross-chain config & supported chains
  registerStreamingTools(server);        // Streaming pay-per-second payments
  registerGovernanceTools(server);       // Governance DAO (in-memory MVP)
  registerBountyTools(server);           // Bounty Board (in-memory MVP)
  registerBridgeTools(server);           // Cross-chain bridge estimates & status
  registerGrantTools(server);            // Grant Program (in-memory MVP)
  registerTrainingTools(server);         // Training Marketplace (in-memory MVP)
  registerVerifyDeepTools(server);        // Deep project verification (off-chain analysis)
  registerRevisionTools(server);          // RevisionManager — revision tracking

  info("[SERVER] corven_ MCP tools registered");
  return server;
}
