#!/usr/bin/env node
/**
 * COVENANT CLI — command-line interface for the COVENANT protocol.
 *
 * Usage:
 *   covenant agent register --name "MyAgent" --capabilities "python,security" --stake 0.001
 *   covenant agent get <address>
 *   covenant agent find --capability "python"
 *   covenant agent list
 *
 *   covenant task create --worker <addr> --payment 0.01 --deadline 1735689600 --desc <cid>
 *   covenant task get <id>
 *   covenant task submit <id> --deliverable <cid>
 *   covenant task verify <id> --success
 *
 *   covenant market post --max-payment 0.05 --deadline 1735689600 --desc <cid>
 *   covenant market bid <id> --price 0.03 --time 3600 --proposal <cid>
 *   covenant market select <id> --worker <addr>
 *
 *   covenant disputes file <taskId> --bond 0.01
 *   covenant disputes vote <disputeId> --for-worker true
 *   covenant disputes get <disputeId>
 *
 *   covenant batches create --workers ... --payments ... --deadlines ... --hashes ... --aggregation ...
 *   covenant batches get <batchId>
 *   covenant batches status <batchId>
 *   covenant batches aggregate <batchId>
 *
 *   covenant collectives create --min-contribution 0.01 --max-members 10
 *   covenant collectives join <collectiveId> --contribution 0.01
 *   covenant collectives get <collectiveId>
 *
 *   covenant insurance join --contribution 0.01
 *   covenant insurance pay <taskId> --premium 0.001
 *   covenant insurance claim <taskId>
 *   covenant insurance balance
 *
 *   covenant receipts get <address>
 *   covenant receipts count <address>
 *
 *   covenant milestones create --worker ... --payment ... --deadline ... --desc ... --milestone-descs ... --milestone-pays ...
 *   covenant milestones submit <taskId> <index> --hash <cid>
 *   covenant milestones verify <taskId> <index>
 *
 *   covenant protocol stats
 *   covenant protocol leaderboard
 */
import { Command } from "commander";
import { registerAgentCommand } from "./commands/agent.js";
import { registerTaskCommand } from "./commands/task.js";
import { registerMarketCommand } from "./commands/market.js";
import { registerProtocolCommand } from "./commands/protocol.js";
import { registerDisputesCommand } from "./commands/disputes.js";
import { registerBatchesCommand } from "./commands/batches.js";
import { registerCollectivesCommand } from "./commands/collectives.js";
import { registerInsuranceCommand } from "./commands/insurance.js";
import { registerReceiptsCommand } from "./commands/receipts.js";
import { registerMilestonesCommand } from "./commands/milestones.js";

const program = new Command();

program
  .name("covenant")
  .description("COVENANT Protocol CLI — on-chain agent marketplace")
  .version("1.0.0");

registerAgentCommand(program);
registerTaskCommand(program);
registerMarketCommand(program);
registerProtocolCommand(program);
registerDisputesCommand(program);
registerBatchesCommand(program);
registerCollectivesCommand(program);
registerInsuranceCommand(program);
registerReceiptsCommand(program);
registerMilestonesCommand(program);

program.parse();
