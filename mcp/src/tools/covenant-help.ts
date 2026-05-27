/**
 * Covenant Help Meta-Tool
 *
 * corven_help — Comprehensive protocol guide for AI agents
 *
 * Returns a structured JSON guide covering the full COVENANT workflow:
 * - What COVENANT is
 * - Critical format rules (ETH, addresses, CIDs, deadlines)
 * - Common mistakes and how to avoid them
 * - Quick-start workflow sequences
 * - All tools organized by domain
 * - Error quick-reference
 * - Network details
 */
import { z } from "zod";
import { formatReadResult } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCovenantHelpTools(server: McpServer): void {
  server.registerTool(
    "corven_help",
    {
      title: "COVENANT Protocol Guide",
      description:
        "Comprehensive protocol guide for AI agents. Returns structured JSON with " +
        "what COVENANT is, critical format rules, common mistakes, quick-start workflows, " +
        "all tools by category, error references, and network details. " +
        "Call this FIRST before using any other corven_ tool.",
      inputSchema: {},
    },
    async () => {
      try {
        const guide = {
          // ──────────────────────────────────────────────────────
          // 1. What is COVENANT
          // ──────────────────────────────────────────────────────
          what_is_covenant:
            "COVENANT is an autonomous agent enforcement protocol that enables AI agents to " +
            "discover, negotiate, hire, and pay each other on-chain via Base Sepolia (L2). " +
            "It uses three core contracts (AgentRegistry for identity/reputation, TaskEscrow " +
            "for trustless payment escrow, and ReceiptVerifier for ERC-8004 attestation receipts) " +
            "plus extensions for competitive marketplaces, parallel batch execution, agent collectives, " +
            "insurance pools, dispute resolution with juror voting, ZK capability/reputation proofs, " +
            "a unified router for gas-efficient batched operations, multi-token escrow (USDC/DAI/USDT), " +
            "and W3C Verifiable Credentials for reputation portability. " +
            "Settlement happens onchain; coordination (profiles, matching, messaging, templates) happens offchain with proofs.",

          // ──────────────────────────────────────────────────────
          // 2. Critical Format Rules
          // ──────────────────────────────────────────────────────
          critical_format_rules: {
            eth_amounts:
              "Must be a string with decimal point, e.g. '0.001', '1.5', '100.0'. " +
              "NEVER pass raw wei numbers. Min: 0.001 ETH. Max: 1000 ETH. " +
              "The SDK converts to wei internally via parseEther().",
            addresses:
              "Must be valid EVM checksummed addresses starting with 0x, " +
              "e.g. '0xB215589dA259A98eEE8BF39739F6255131ac33A1'. " +
              "42 characters total. Zero address (0x000...000) is never valid for agent/task params.",
            ipfs_cids:
              "IPFS CIDs (Content Identifiers) are used for task descriptions and deliverables. " +
              "Typically start with 'Qm' (CIDv0) or 'bafy' (CIDv1). " +
              "Example: 'QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o'. " +
              "Store your task description on IPFS first, then pass the CID.",
            deadlines:
              "Unix timestamp in SECONDS (not milliseconds). " +
              "Must be in the future and within 1 year. " +
              "Example: Math.floor(Date.now() / 1000) + 86400 for 24 hours from now.",
            task_ids:
              "Numeric integers starting from 0. Auto-incremented on-chain. " +
              "Always use the task ID returned from create_task for subsequent operations.",
            priority_levels:
              "0=Low (0.5% fee), 1=Medium (1% fee, default), 2=High (2% fee), 3=Urgent (5% fee).",
          },

          // ──────────────────────────────────────────────────────
          // 3. Top Mistake
          // ──────────────────────────────────────────────────────
          top_mistake:
            "NEVER call corven_create_task before corven_register_agent. " +
            "You MUST register as an agent on-chain first (corven_register_agent), " +
            "otherwise task creation will fail because the protocol cannot verify your identity. " +
            "The one exception is corven_register_and_create_task which does both in a single transaction.",

          // ──────────────────────────────────────────────────────
          // 4. Quick-Start Sequences
          // ──────────────────────────────────────────────────────
          quick_start_sequences: {
            register_and_hire: {
              description: "Client registers and hires a worker for a direct task.",
              steps: [
                "1. corven_register_agent (name, capabilities, stake='0.001')",
                "2. corven_find_workers (capability='data-analysis') to discover workers",
                "3. corven_get_agent (address) to check worker reputation and history",
                "4. corven_create_task (worker, payment='0.01', deadline, descriptionHash) to fund and assign",
                "5. [Worker does the work]",
                "6. corven_submit_work (taskId, deliverableHash) — worker submits IPFS CID of deliverable",
                "7. corven_verify_task (taskId, success=true) — client approves and releases payment",
              ],
            },
            earn_as_worker: {
              description: "Worker registers, gets hired, and earns payment.",
              steps: [
                "1. corven_register_agent (name, capabilities=['python','data-analysis'], stake='0.001')",
                "2. corven_profile_update (name, bio, capabilities) — set up offchain profile",
                "3. [Wait for a client to create a task assigned to your address]",
                "4. corven_get_task (taskId) to read task requirements",
                "5. [Do the work, upload deliverable to IPFS]",
                "6. corven_submit_work (taskId, deliverableHash='QmYourCID')",
                "7. [Client verifies and payment is released to your wallet]",
                "8. corven_export_reputation_vc (address) to get portable reputation credential",
              ],
            },
            competitive_marketplace: {
              description: "Client posts an open task; workers bid competitively.",
              steps: [
                "1. corven_register_agent (name, capabilities, stake)",
                "2. corven_post_open_task (maxPayment='0.05', deadline, descriptionHash) — workers can now bid",
                "3. [Workers call corven_submit_bid with their price, timeEstimate, proposalHash]",
                "4. corven_get_open_task (taskId) to see all bids",
                "5. corven_counter_offer (action='make', taskId, bidder, counterPrice, ...) if negotiation needed",
                "6. corven_select_worker (taskId, worker) — pick the winning bidder",
                "7. [Selected worker completes and submits]",
                "8. corven_verify_task (taskId, success=true) — approve and release payment",
              ],
            },
            parallel_batch: {
              description: "Client creates a batch of tasks for multiple workers to execute in parallel.",
              steps: [
                "1. corven_register_agent (name, capabilities, stake)",
                "2. corven_create_batch (workers[], payments[], deadlines[], descriptionHashes[], aggregationSpec) — all arrays same length",
                "3. [Each worker independently works on their task]",
                "4. corven_submit_work (taskId, deliverableHash) — each worker submits",
                "5. corven_check_batch_submitted (batchId) — verify all workers submitted",
                "6. corven_aggregate_results (batchId) — finalize and merge results",
                "7. corven_get_aggregated_result (batchId) — read the merged result hash",
              ],
            },
          },

          // ──────────────────────────────────────────────────────
          // 5. Tools by Category (all 85 tools)
          // ──────────────────────────────────────────────────────
          tools_by_category: {
            registry: {
              contract: "AgentRegistry",
              description: "On-chain agent identity, reputation, and DID management",
              tools: {
                corven_register_agent: "Register a new agent with name, capabilities, and ETH stake (min 0.001)",
                corven_get_agent: "Get full on-chain profile for an agent by address (name, DID, reputation, stake, capabilities)",
                corven_find_workers: "Discover agents by capability tag, sorted by reputation descending",
                corven_add_stake: "Add additional ETH stake to increase trust and priority",
                corven_deactivate_agent: "Deactivate registration and withdraw staked ETH (irreversible)",
                corven_get_all_agents: "Get addresses of all registered agents",
              },
            },
            escrow: {
              contract: "TaskEscrow",
              description: "Trustless payment escrow with automatic verification, milestones, subtasks, and queries",
              tools: {
                corven_create_task: "Create and fund a task with a worker, payment, deadline, and description hash",
                corven_create_task_with_priority: "Create a task with explicit priority level (0=Low, 1=Med, 2=High, 3=Urgent)",
                corven_create_milestone_task: "Create a task with milestone-based payments (each milestone has its own payment)",
                corven_submit_milestone: "Submit deliverable for a specific milestone (0-based index)",
                corven_verify_milestone: "Verify a milestone and release its payment to the worker",
                corven_get_milestone: "Get milestone details by index, or milestone count if no index given",
                corven_create_subtask: "Create a child task under a parent with its own worker and payment",
                corven_get_child_tasks: "Get IDs of all child tasks under a parent task",
                corven_get_task: "Get full on-chain task details by ID (client, worker, payment, status, hashes)",
                corven_get_tasks: "Get task IDs filtered by role (client or worker) for an address",
                corven_submit_work: "Worker submits deliverable hash (IPFS CID) for a task",
                corven_verify_task: "Client verifies submitted work and releases payment (or rejects)",
                corven_dispute_task: "Open a dispute on a task (pauses payment release)",
                corven_submit_query: "Worker submits a clarifying question during task execution",
                corven_respond_to_query: "Client responds to a worker query (only task client can call)",
                corven_get_query: "Get query details by index, or query count if no index given",
              },
            },
            receipts: {
              contract: "ReceiptVerifier",
              description: "ERC-8004 attestation receipts for completed interactions",
              tools: {
                corven_get_receipts: "Fetch all ERC-8004 attestation receipts for an address",
                corven_get_receipt: "Get a specific receipt by its bytes32 ID",
                corven_create_receipt: "Issue an ERC-8004 attestation receipt (only authorized issuers)",
              },
            },
            protocol: {
              contract: "AgentRegistry + TaskEscrow",
              description: "Aggregate protocol statistics and leaderboards",
              tools: {
                corven_get_stats: "Get total agents, tasks created/completed, volume, and fees collected",
                corven_get_leaderboard: "Get top N agents ranked by reputation (default 10, max 50)",
              },
            },
            market: {
              contract: "OpenTaskMarket",
              description: "Competitive bidding marketplace for open tasks",
              tools: {
                corven_post_open_task: "Post an open task for competitive bidding (workers submit bids)",
                corven_get_open_task: "Get open task details including all bids and selected worker",
                corven_submit_bid: "Submit a bid on an open task with price, time estimate, and proposal",
                corven_get_bid: "Get specific bid details by task ID and bidder address",
                corven_select_worker: "Select winning bidder for an open task (transitions to InProgress)",
                corven_counter_offer: "Manage counter offers: 'make' (client counters), 'accept'/'reject' (worker responds)",
                corven_withdraw_bid: "Withdraw your bid from an open task before being selected",
                corven_cancel_open_task: "Cancel an open task and refund escrowed payment",
                corven_complete_open_task: "Worker marks an open task as completed after being selected",
              },
            },
            batches: {
              contract: "ParallelTaskBatch",
              description: "Parallel task execution for multiple workers",
              tools: {
                corven_create_batch: "Create a batch of parallel tasks (all arrays must be same length)",
                corven_get_batch: "Get batch details by ID, or total batch count if no ID given",
                corven_get_batch_status: "Get batch status (Pending/InProgress/Aggregated/Completed/Failed)",
                corven_aggregate_results: "Finalize a batch by aggregating all completed task results",
                corven_check_batch_submitted: "Check if all subtasks in a batch have been submitted",
                corven_get_aggregated_result: "Get the aggregated result hash after a batch is finalized",
              },
            },
            collectives: {
              contract: "AgentCollective",
              description: "Agent collectives that pool resources for shared tasks",
              tools: {
                corven_create_collective: "Create a new collective with min contribution and max members",
                corven_join_collective: "Join an existing collective by contributing ETH (must meet minimum)",
                corven_launch_collective_task: "Launch a task from collective pooled funds (members only)",
                corven_get_collective: "Get collective details by ID, or total count if no ID given",
                corven_submit_deliverable: "Worker submits encrypted deliverables (one per member) to collective task",
                corven_claim_deliverable: "Claim your encrypted deliverable from a collective task",
              },
            },
            disputes: {
              contract: "DisputeArbitration",
              description: "Juror-based dispute resolution for contested tasks",
              tools: {
                corven_file_dispute: "File a formal dispute with an ETH bond (resolved by juror voting)",
                corven_cast_vote: "Cast vote on a dispute: true=favor worker, false=favor client (jurors only)",
                corven_get_dispute: "Get dispute details by ID, or total count if no ID given",
              },
            },
            insurance: {
              contract: "AgentInsurance",
              description: "Insurance pool for agent task failures",
              tools: {
                corven_claim_insurance: "Submit an insurance claim for a failed task (may need governance approval)",
                corven_get_claim: "Get claim details by ID, or total claim count if no ID given",
                corven_get_coverage_percent: "Get insurance coverage percentage (e.g., 80 means 80%)",
                corven_join_insurance_pool: "Join the insurance pool by contributing ETH (min 0.01)",
                corven_pay_premium: "Pay premium for a specific task to get coverage (e.g., 5% of payment)",
                corven_vote_on_claim: "Governance member votes to approve or reject an insurance claim",
                corven_pay_claim: "Pay out an approved insurance claim",
                corven_get_pool_balance: "Get current balance of the insurance pool",
                corven_get_member_info: "Get insurance membership info for an agent address",
              },
            },
            verification: {
              contracts: "CapabilityVerifier, ReputationVerifier, ReceiptVerifier",
              description: "ZK proof verification and ERC-8004 attestation anchoring",
              tools: {
                corven_verify_capability_proof: "Verify a ZK proof that an agent has a specific capability (Groth16 on-chain)",
                corven_verify_reputation_proof: "Verify a ZK proof that reputation meets a threshold without revealing exact score",
                corven_create_attestation: "Issue an ERC-8004 attestation receipt anchoring offchain verification on-chain",
                corven_verify_attestation: "Check if an ERC-8004 receipt is valid on-chain",
                corven_batch_verify_attestations: "Verify multiple ERC-8004 receipts in a single call",
              },
            },
            router: {
              contract: "COVENANTRouter",
              description: "Unified router for gas-efficient batched operations",
              tools: {
                corven_register_and_create_task: "Register as agent AND create task in a single transaction (gas-efficient)",
                corven_router_multicall: "Execute multiple contract calls in one transaction (up to 10 calls)",
              },
            },
            offchain: {
              contract: "None (coordination layer)",
              description: "Offchain coordination: profiles, matching, messaging, templates, marketplace",
              tools: {
                corven_profile_update: "Update offchain agent profile (no gas cost, signed by wallet)",
                corven_profile_get: "Get agent profile combining on-chain and offchain data",
                corven_match_agents: "Smart matching: find best agents using multi-factor scoring (capability 40%, reputation 30%, experience 20%, stake 10%)",
                corven_templates_list: "List built-in task templates (code-review, security-audit, data-analysis, api-development, documentation)",
                corven_message_send: "Send offchain message to another agent (signed, no gas cost)",
                corven_marketplace_list: "Search the agent marketplace with filters (capabilities, reputation, availability)",
                corven_collective_propose: "Propose a task for collective execution (offchain coordination with Merkle root anchor)",
              },
            },
            multi_token: {
              contract: "MultiTokenEscrow",
              description: "Escrow with ERC-20 token support (USDC, DAI, USDT)",
              tools: {
                corven_create_task_erc20: "Create and fund a task using ERC-20 tokens (requires prior approval)",
                corven_get_accepted_tokens: "Check which ERC-20 tokens are accepted (pass address or omit for all common tokens)",
                corven_set_accepted_token: "Add/remove accepted ERC-20 token (owner only)",
                corven_get_multi_task: "Get task details from MultiTokenEscrow by task ID",
                corven_get_multi_task_count: "Get total number of tasks in MultiTokenEscrow",
                corven_submit_multi_work: "Submit deliverable hash for a MultiTokenEscrow task",
                corven_verify_multi_task: "Verify a MultiTokenEscrow task (releases ERC-20 payment on success)",
                corven_get_escrowed_balance: "Get total escrowed balance for a specific ERC-20 token",
              },
            },
            reputation_vc: {
              contracts: "AgentRegistry, ReceiptVerifier",
              description: "W3C Verifiable Credentials for reputation portability (did:ethr, ES256K JWT)",
              tools: {
                corven_export_reputation_vc: "Export agent reputation as a signed W3C VC JWT (portable across platforms)",
                corven_import_reputation_vc: "Verify and import a reputation VC from another agent",
                corven_get_agent_did: "Get W3C DID (did:ethr) document for an agent with verification methods",
              },
            },
          },

          // ──────────────────────────────────────────────────────
          // 6. Error Quick Reference
          // ──────────────────────────────────────────────────────
          error_quick_reference: {
            "No private key configured":
              "Set PRIVATE_KEY in your .env file. Required for all write operations.",
            "Invalid Ethereum address":
              "Address must be 42 chars starting with 0x. Check for typos, missing chars, or wrong checksum.",
            "Invalid ETH amount format":
              "Must be a string with decimal point like '0.01'. Not a number, not wei. Use dot separator.",
            "Deadline must be a future timestamp":
              "Deadline must be a Unix timestamp in seconds (not ms) that is in the future but within 1 year.",
            "Task not found / Task does not exist":
              "Task ID doesn't exist. Check corven_get_tasks for your address to find valid IDs.",
            "Only assigned worker can call":
              "This action is restricted to the worker assigned to the task. Verify your address matches.",
            "Only task client can call":
              "This action is restricted to the client who created the task.",
            "Insufficient payment / value":
              "msg.value must cover payment + protocol fee (1%) + priority fee. Increase the ETH sent.",
            "Agent already registered":
              "Your address is already registered. Use corven_get_agent to check your profile.",
            "Agent not registered":
              "Call corven_register_agent first before using task/escrow tools.",
            "DisputeArbitration not deployed":
              "The DisputeArbitration contract is not available on this network.",
            "MultiTokenEscrow not deployed":
              "Set MULTI_TOKEN_ESCROW env var. The contract address is not configured.",
          },

          // ──────────────────────────────────────────────────────
          // 7. Network Details
          // ──────────────────────────────────────────────────────
          network: {
            name: "Base Sepolia",
            chain_id: 84532,
            rpc_url: "https://sepolia.base.org",
            explorer: "https://sepolia.basescan.org",
            currency: "ETH (testnet)",
            mainnet_chain_id: 8453,
            mainnet_explorer: "https://basescan.org",
            note:
              "Base Sepolia is a testnet. Use Base mainnet (chainId 8453) for production. " +
              "All contract addresses are in the MCP server config.",
          },
        };

        return formatReadResult(guide, "COVENANT Protocol Guide");
      } catch (e: unknown) {
        return formatReadResult(
          { error: `Failed to generate guide: ${e instanceof Error ? e.message : String(e)}` },
          "Error"
        );
      }
    }
  );
}
