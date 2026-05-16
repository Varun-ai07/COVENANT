/**
 * COVENANT MCP Server — tool registration hub.
 *
 * Registers 70 MCP tools (all prefixed with corven_) across 9 contracts:
 *   AgentRegistry (6):    corven_register_agent, corven_get_agent, corven_find_workers,
 *                         corven_add_stake, corven_deactivate_agent, corven_get_all_agents
 *   TaskEscrow (19):      corven_create_task, corven_get_task, corven_submit_work, corven_verify_task,
 *                         corven_dispute_task, corven_create_task_with_priority, corven_create_milestone_task,
 *                         corven_submit_milestone, corven_verify_milestone, corven_get_milestone,
 *                         corven_get_milestone_count, corven_create_subtask, corven_get_child_tasks,
 *                         corven_submit_query, corven_respond_to_query, corven_get_query,
 *                         corven_get_query_count, corven_get_client_tasks, corven_get_worker_tasks
 *   ReceiptVerifier (4):  corven_get_receipts, corven_verify_receipt, corven_create_receipt, corven_get_receipt_count
 *   Protocol (2):         corven_get_stats, corven_get_leaderboard
 *   OpenTaskMarket (11):  corven_post_open_task, corven_get_open_task, corven_submit_bid, corven_get_bid,
 *                         corven_select_worker, corven_make_counter_offer, corven_accept_counter_offer,
 *                         corven_withdraw_bid, corven_cancel_open_task, corven_complete_open_task,
 *                         corven_reject_counter_offer
 *   ParallelTaskBatch (7):corven_create_batch, corven_get_batch, corven_get_batch_status,
 *                         corven_aggregate_results, corven_get_batch_counter, corven_check_batch_submitted,
 *                         corven_get_aggregated_result
 *   AgentCollective (7):  corven_create_collective, corven_join_collective, corven_launch_collective_task,
 *                         corven_get_collective, corven_get_collective_counter, corven_submit_deliverable,
 *                         corven_claim_deliverable
 *   DisputeArbitration (4):corven_file_dispute, corven_cast_vote, corven_get_dispute, corven_get_dispute_counter
 *   AgentInsurance (10):  corven_claim_insurance, corven_get_claim, corven_get_claim_counter,
 *                         corven_get_coverage_percent, corven_join_insurance_pool, corven_pay_premium,
 *                         corven_vote_on_claim, corven_pay_claim, corven_get_pool_balance, corven_get_member_info
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

  info("[SERVER] Registered 70 corven_ MCP tools across 9 contracts");
  return server;
}
