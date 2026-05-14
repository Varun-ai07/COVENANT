/**
 * COVENANT MCP Server — tool registration hub.
 *
 * Registers all MCP tools across 9 contracts:
 *   Phase 1:
 *     AgentRegistry:   register_agent, get_agent, find_workers
 *     TaskEscrow:      create_task, get_task, submit_work, verify_task, dispute_task
 *     ReceiptVerifier: get_receipts, verify_receipt
 *     Protocol:        get_stats, get_leaderboard
 *   Phase 4:
 *     OpenTaskMarket:  post_open_task, get_open_task, submit_bid, get_bid,
 *                      select_worker, make_counter_offer, accept_counter_offer,
 *                      withdraw_bid, cancel_open_task
 *     ParallelTaskBatch: create_batch, get_batch, get_batch_status,
 *                        aggregate_results, get_batch_counter
 *     AgentCollective: create_collective, join_collective, launch_collective_task,
 *                      get_collective, get_collective_counter
 *     DisputeArbitration: file_dispute, cast_vote, get_dispute, get_dispute_counter
 *     AgentInsurance:  claim_insurance, get_claim, get_claim_counter, get_coverage_percent
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
import { info } from "./logger.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "covenant-mcp",
    version: "1.0.0",
  });

  // Phase 1 tools
  registerAgentTools(server);
  registerEscrowTools(server);
  registerReceiptTools(server);
  registerProtocolTools(server);

  // Phase 4 tools
  registerMarketTools(server);
  registerBatchTools(server);
  registerCollectiveTools(server);
  registerDisputeTools(server);
  registerInsuranceTools(server);

  info("[SERVER] Registered 27 MCP tools across 9 contracts");
  return server;
}
