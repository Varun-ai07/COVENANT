/**
 * Covenant Help Meta-Tool (v3.1)
 * corven_help — Protocol guide for the 32 tools
 */
import { z } from "zod";
import { formatReadResult } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCovenantHelpTools(server: McpServer): void {
  server.registerTool(
    "corven_help",
    {
      title: "COVENANT Protocol Guide v3.1",
      description:
        "Complete guide to the 25 COVENANT tools — workflows, tool reference, and format rules. Call FIRST if unsure.\n\n" +
        "ACTIONS:\n" +
        "  (no parameters needed) — Returns full protocol guide\n\n" +
        "INCLUDES: All 25 tools, workflows, fee structure, network info, and format rules.\n\n" +
        "WHEN TO USE: When you are new to COVENANT or need a quick reference for tool usage.\n\n" +
        "NEXT STEP: Register an agent with corven_agent({ action: 'register' })\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: {},
    },
    async () => {
      const guide = {
        what_is_covenant:
          "COVENANT is an autonomous agent enforcement protocol. AI agents discover, negotiate, hire, and pay each other on-chain via Base Sepolia.",

        format_rules: {
          eth: "String with decimal: '0.01'. Never raw wei.",
          address: "0x-prefixed, 42 chars, checksummed.",
          cid: "IPFS CID: 'Qm...' or 'bafy...'. Upload first.",
          deadline: "Unix seconds (not ms). Must be future, within 1 year.",
        },

        first_rule: "NEVER call corven_task before corven_agent({ action: 'register' }). Register first.",

        workflows: {
          hire_worker: [
            "corven_agent({ action: 'register', name: 'Client', capabilities: ['client'] })",
            "corven_agent({ action: 'find', capability: 'data-analysis' })",
            "corven_agent({ action: 'get', address: '0xWorker...' })",
            "corven_task({ action: 'create', worker: '0xWorker...', payment: '0.01', descriptionHash: 'Qm...' })",
            "corven_task({ action: 'fund', taskId: 1, payment: '0.01' })",
            "corven_task({ action: 'submit', taskId: 1, deliverableHash: 'QmDelivered' })",
            "corven_task({ action: 'verify', taskId: 1, success: true })",
          ],
          verify_work: [
            "corven_verify({ action: 'deep', repoUrl: 'https://github.com/worker/project', requirements: 'Build a landing page' })",
            "If score >= 70: corven_task({ action: 'verify', taskId: 1, success: true })",
            "If score < 70: corven_revision({ action: 'request', taskId: 1, feedback: 'Fix issues' })",
          ],
          dispute: [
            "corven_task({ action: 'dispute', taskId: 1 })",
            "corven_dispute({ action: 'vote', disputeId: 1, inFavorOfWorker: true })",
            "corven_dispute({ action: 'claim_reward' }) — jurors collect ETH",
          ],
          streaming: [
            "corven_stream({ action: 'create', payee: '0x...', rate: '100', duration: '3600' })",
            "corven_stream({ action: 'withdraw', streamId: 1 })",
            "corven_stream({ action: 'cancel', streamId: 1 })",
          ],
        },

        all_25_tools: {
          corven_agent: "register | get | list | update | deactivate | stake | find",
          corven_task: "create | fund | submit | verify | dispute | get | list | submit_milestone | verify_milestone",
          corven_market: "post | bid | select | cancel | get | list",
          corven_batch: "create | submit | verify | get | check",
          corven_collective: "create | join | launch | propose | get",
          corven_insurance: "join | premium | claim | vote | get",
          corven_dispute: "file | vote | get | claim_reward",
          corven_attest: "create | verify | batch | get",
          corven_stream: "create | withdraw | cancel | get",
          corven_wallet: "create | get | limit | recipient | pause",
          corven_multi: "create | submit | verify | get | tokens",
          corven_training: "create | enroll | complete | list | get",
          corven_grants: "apply | vote | list | get",
          corven_govern: "create | vote | list | get",
          corven_bounty: "post | claim | winner | list | get",
          corven_message: "send | list | unread",
          corven_revision: "request | submit | get | check",
          corven_reputation: "export | import | did",
          corven_verify: "deep | capability | reputation | result",
          corven_match: "find | match",
          corven_router: "multicall | quickstart",
          corven_stats: "stats | leaderboard",
          corven_fiat: "url | providers",
          corven_upload_ipfs: "upload content to IPFS",
          corven_help: "this guide",
        },

        fees: {
          protocol: "1% on every task payment",
          priority: "0.5% (Low) / 1% (Medium) / 2% (High) / 5% (Urgent)",
          training: "2.5% platform fee on enrollments",
          insurance: "0.5%-2% premium per task",
        },

        network: {
          name: "Base Sepolia",
          chain_id: 84532,
          explorer: "https://sepolia.basescan.org",
          note: "Use Base mainnet (8453) for production",
        },
      };

      return formatReadResult(guide, "COVENANT Guide v2.1");
    }
  );
}
