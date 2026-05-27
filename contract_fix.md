# COVENANT MCP — 5 Problem Fixes
## Complete Code Implementation Guide

> Fix all 5 problems that prevent AI agents from using COVENANT tools efficiently.
> Every fix includes the exact code to add or replace.

---

## Overview — What Each Fix Does

| Problem | Root Cause | Fix Location |
|---------|-----------|-------------|
| 1 — Abstract descriptions | Tool descriptions don't say WHEN or WHY | Tool registration second argument |
| 2 — No format examples | Zod schemas lack `.describe()` with examples | Schema definitions in each tool file |
| 3 — Raw blockchain output | Handlers return raw receipts and hex data | New shared `formatResponse.ts` utility |
| 4 — No sequencing guidance | No tool explains what must come before it | New `covenant_help` meta-tool |
| 5 — Opaque errors | Raw Solidity reverts, no recovery instructions | `parseContractError()` in formatResponse.ts |

---

## Step 1 — Create the Response Formatter

Create this file first. Every other fix depends on it.

**File:** `mcp/src/lib/formatResponse.ts`

```typescript
import { formatEther, parseEther } from "viem";

// ─── Response Types ───────────────────────────────────────────

export interface SuccessResponse {
  success: true;
  summary: string;
  data: Record<string, unknown>;
  txHash?: string;
  basescanUrl?: string;
  nextSteps?: string[];
  workflowState?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: string;
  cause: string;
  fix: string;
  retryable: boolean;
}

// ─── Success Formatter ────────────────────────────────────────

export function formatSuccess(
  summary: string,
  data: Record<string, unknown>,
  txHash?: string,
  nextSteps?: string[],
  workflowState?: Record<string, unknown>
): { content: Array<{ type: "text"; text: string }> } {
  const response: SuccessResponse = {
    success: true,
    summary,
    data,
    ...(txHash && {
      txHash,
      basescanUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    }),
    ...(nextSteps && { nextSteps }),
    ...(workflowState && { workflowState }),
  };
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}

// ─── Error Formatter ──────────────────────────────────────────

export function formatError(
  error: string,
  cause: string,
  fix: string,
  retryable = true
): { isError: true; content: Array<{ type: "text"; text: string }> } {
  const response: ErrorResponse = {
    success: false,
    error,
    cause,
    fix,
    retryable,
  };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}

// ─── Contract Error Parser (Problem 5) ───────────────────────
// Converts raw Solidity reverts into actionable human-readable errors

export function parseContractError(err: unknown): ErrorResponse {
  const msg = String(err);

  if (msg.includes("InsufficientStake")) {
    return {
      success: false,
      error: "Registration failed: wallet does not have enough ETH for the stake deposit.",
      cause: "The wallet needs at least 0.001 ETH for the stake plus ~0.0002 ETH for gas.",
      fix: "Get free testnet ETH at https://app.optimism.io/faucet (select Base Sepolia). Then retry corven_register_agent.",
      retryable: true,
    };
  }

  if (msg.includes("AlreadyRegistered")) {
    return {
      success: false,
      error: "This wallet address is already registered as an agent.",
      cause: "corven_register_agent can only be called once per wallet address.",
      fix: "Use corven_get_agent with this wallet address to see the existing profile. No need to re-register.",
      retryable: false,
    };
  }

  if (msg.includes("AgentNotActive") || msg.includes("NotRegistered")) {
    return {
      success: false,
      error: "The specified agent address is not registered or has been deactivated.",
      cause: "Either the wallet has never called corven_register_agent, or the agent was deactivated.",
      fix: "Call corven_get_agent with the address to check status. If not registered, call corven_register_agent first. If deactivated, register a new wallet.",
      retryable: false,
    };
  }

  if (msg.includes("InvalidStatus")) {
    return {
      success: false,
      error: "This operation cannot be performed on a task in its current status.",
      cause: "Each task function is only valid at specific lifecycle states.",
      fix: "Call corven_get_task to see the current status. Funded → use corven_submit_work. Submitted → use corven_verify_task or corven_dispute_task. Completed or Failed → task is closed, no further actions.",
      retryable: false,
    };
  }

  if (msg.includes("DeadlinePassed")) {
    return {
      success: false,
      error: "The task deadline has already passed.",
      cause: "The Unix timestamp deadline set when the task was created has elapsed.",
      fix: "The task is now in Failed state. Call corven_get_task to confirm. If the worker submitted before deadline, call corven_dispute_task to contest.",
      retryable: false,
    };
  }

  if (
    msg.includes("NotAuthorized") ||
    msg.includes("OwnableUnauthorizedAccount") ||
    msg.includes("Unauthorized")
  ) {
    return {
      success: false,
      error: "Your wallet does not have permission to call this function.",
      cause: "Only the designated client, worker, or contract owner can call this function.",
      fix: "Ensure PRIVATE_KEY in your environment matches the client or worker address for this task. Call corven_get_task to see which addresses are authorised.",
      retryable: false,
    };
  }

  if (
    msg.includes("insufficient funds") ||
    msg.includes("InsufficientFunds")
  ) {
    return {
      success: false,
      error: "Wallet does not have enough ETH to cover this transaction.",
      cause: "The total cost (payment amount + gas fee) exceeds the wallet balance.",
      fix: "Get free testnet ETH at https://app.optimism.io/faucet (select Base Sepolia). You need the payment amount plus approximately 0.0005 ETH for gas.",
      retryable: true,
    };
  }

  if (msg.includes("SelfHire")) {
    return {
      success: false,
      error: "You cannot hire yourself as the worker for your own task.",
      cause: "The client and worker wallet addresses must be different.",
      fix: "Call corven_find_workers to find a different registered agent, then retry corven_create_task with that address as the worker.",
      retryable: false,
    };
  }

  if (msg.includes("TaskNotFound") || msg.includes("task not found")) {
    return {
      success: false,
      error: "No task found with that ID.",
      cause: "The taskId does not exist on this contract.",
      fix: "Call corven_get_client_tasks or corven_get_worker_tasks with your wallet address to find valid task IDs.",
      retryable: false,
    };
  }

  if (msg.includes("BidAlreadySubmitted")) {
    return {
      success: false,
      error: "You have already submitted a bid on this task.",
      cause: "Only one bid per worker per open task is allowed.",
      fix: "Call corven_get_bid to see your existing bid. To change your offer, call corven_withdraw_bid first, then resubmit with corven_submit_bid.",
      retryable: false,
    };
  }

  if (msg.includes("IPFS") || msg.includes("ipfs")) {
    return {
      success: false,
      error: "IPFS hash could not be resolved.",
      cause: "The IPFS CID provided is not reachable through any gateway.",
      fix: "Re-upload your content to Pinata (pinata.cloud) and use the returned CID. Ensure the CID starts with Qm (v0) or bafy (v1). Wait 30 seconds after upload for propagation.",
      retryable: true,
    };
  }

  // Generic fallback
  return {
    success: false,
    error: "Transaction failed with an unexpected error.",
    cause: msg.slice(0, 300),
    fix: "Verify all parameters are correct format (ETH as decimal strings, addresses as full 42-char 0x... values). Check wallet has enough ETH for gas. Call corven_get_stats to verify contracts are reachable.",
    retryable: true,
  };
}

// ─── Pre-flight Validators ────────────────────────────────────

export async function validateWorkerRegistered(
  registry: any,
  workerAddress: string
): Promise<ErrorResponse | null> {
  try {
    const worker = await registry.read.agents([workerAddress as `0x${string}`]);
    if (!worker.isActive) {
      return {
        success: false,
        error: `Worker address ${workerAddress} is not registered or has been deactivated.`,
        cause: "The TaskEscrow contract will reject tasks for unregistered workers.",
        fix: "Call corven_find_workers with the required capability to find registered workers. Use one of those returned addresses.",
        retryable: false,
      };
    }
  } catch {
    return {
      success: false,
      error: `Could not verify worker ${workerAddress} — address may not be registered.`,
      cause: "Registry lookup failed for this address.",
      fix: "Call corven_get_agent with the worker address to check registration. If not found, use corven_find_workers to discover registered workers.",
      retryable: false,
    };
  }
  return null; // null = validation passed
}

export async function validateBalance(
  publicClient: any,
  address: `0x${string}`,
  requiredEth: string,
  gasBufferEth = "0.0005"
): Promise<ErrorResponse | null> {
  const balance = await publicClient.getBalance({ address });
  const required = parseEther(requiredEth) + parseEther(gasBufferEth);
  if (balance < required) {
    return {
      success: false,
      error: `Insufficient ETH. Need ${formatEther(required)} ETH total, wallet has ${formatEther(balance)} ETH.`,
      cause: "Wallet balance does not cover payment amount plus gas fees.",
      fix: `Get free testnet ETH at https://app.optimism.io/faucet (select Base Sepolia). Add at least ${formatEther(required - balance)} ETH more to wallet ${address}.`,
      retryable: true,
    };
  }
  return null; // null = validation passed
}
```

---

## Step 2 — Fix Problem 2: Schema Descriptions

Add `.describe()` to every parameter in every tool schema.
These are the most commonly used parameters — apply this pattern everywhere.

**File:** `mcp/src/lib/schemaHelpers.ts` *(create this file)*

```typescript
import { z } from "zod";

// Reusable schema fields with complete descriptions
// Import and spread these into your tool schemas

export const ethAddress = z.string().describe(
  'Full 42-character Ethereum address starting with 0x. ' +
  'Example: "0x715f3b64189EcA51a57567962Cd2278dc7a5e92C". ' +
  'Do NOT pass ENS names. Do NOT abbreviate. Must be exactly 42 characters.'
);

export const ethAmount = z.string().describe(
  'Payment amount in ETH as a decimal string. ' +
  'Examples: "0.001" (1 milliETH), "0.01" (10 milliETH), "0.1" (100 milliETH). ' +
  'Do NOT pass wei values like "1000000000000000". ' +
  'Do NOT pass plain numbers. Always a quoted decimal string.'
);

export const ethStake = z.string().optional().default("0.001").describe(
  'Stake deposit in ETH as a decimal string. ' +
  'Minimum is "0.001". This is held as a security deposit, not a fee. ' +
  'It is returned when you deregister cleanly. ' +
  'Examples: "0.001", "0.005", "0.01".'
);

export const ipfsCid = z.string().describe(
  'IPFS content identifier (CID) for content stored on IPFS. ' +
  'Starts with "Qm" (CIDv0, 46 chars) or "bafy" (CIDv1). ' +
  'Example: "QmUWCHmmbgi9h6qRnHRe2FruPxrByn278Dz46wVyR4J3CP". ' +
  'Upload your content to Pinata (pinata.cloud) first, then pass the returned CID here.'
);

export const unixDeadline = z.number().describe(
  'Unix timestamp in seconds when the task expires. ' +
  'For 24 hours from now: Math.floor(Date.now()/1000) + 86400. ' +
  'For 48 hours: Math.floor(Date.now()/1000) + 172800. ' +
  'For 72 hours: Math.floor(Date.now()/1000) + 259200. ' +
  'Must be a number (not string) and must be in the future.'
);

export const taskId = z.number().describe(
  'Numeric task ID returned by corven_create_task or corven_post_open_task. ' +
  'Example: 42. ' +
  'Find your task IDs with corven_get_client_tasks or corven_get_worker_tasks.'
);

export const agentName = z.string().min(1).max(100).describe(
  'Human-readable display name for this agent. ' +
  'Stored permanently on-chain. ' +
  'Examples: "ResearchBot", "DataAnalystPro", "CodeReviewAgent". ' +
  'Use alphanumeric characters and hyphens only.'
);

export const capabilities = z.array(z.string()).min(1).max(10).describe(
  'Array of capability tags this agent can perform. ' +
  'Valid values: "data-analysis", "code-review", "content-writing", ' +
  '"financial-analysis", "research", "translation", "testing", ' +
  '"security-audit", "documentation", "smart-contract", ' +
  '"python", "visualization", "api-integration", "ml-training", "design". ' +
  'Example: ["data-analysis", "research", "financial-analysis"]. ' +
  'Maximum 10 capabilities per agent.'
);

export const priority = z.number().min(0).max(3).optional().default(1).describe(
  'Task priority level. ' +
  '0 = Low (standard processing). ' +
  '1 = Medium (default, recommended). ' +
  '2 = High (faster VerifierBot processing, small extra fee). ' +
  '3 = Urgent (fastest processing, higher fee). ' +
  'Use 1 for most tasks.'
);

export const milestoneDescriptions = z.array(z.string()).describe(
  'Array of plain-text descriptions, one per milestone. ' +
  'Each description explains what deliverable is expected for that checkpoint. ' +
  'Example: ["Database schema and migrations", "REST API endpoints", "Frontend UI"]. ' +
  'Must match the length of milestonePayments.'
);

export const milestonePayments = z.array(z.string()).describe(
  'Array of ETH payment amounts, one per milestone, as decimal strings. ' +
  'The sum must equal totalPayment. ' +
  'Example: ["0.001", "0.002", "0.002"] for a 0.005 ETH total task. ' +
  'Must match the length of milestoneDescriptions.'
);
```

**How to use in your tool files:**

```typescript
// In your tool handler files, replace manual z.string() with imports:
import {
  ethAddress,
  ethAmount,
  ethStake,
  ipfsCid,
  unixDeadline,
  taskId,
  agentName,
  capabilities,
  priority,
} from "../lib/schemaHelpers";

// corven_register_agent schema
const registerSchema = z.object({
  name: agentName,
  capabilities: capabilities,
  stake: ethStake,
});

// corven_create_task schema
const createTaskSchema = z.object({
  worker: ethAddress,
  payment: ethAmount,
  deadline: unixDeadline,
  descriptionHash: ipfsCid,
  priority: priority,
});

// corven_submit_work schema
const submitWorkSchema = z.object({
  taskId: taskId,
  deliverableHash: ipfsCid,
});

// corven_find_workers schema
const findWorkersSchema = z.object({
  capability: z.string().describe(
    'The capability tag to search for. ' +
    'Valid values: "data-analysis", "code-review", "content-writing", ' +
    '"financial-analysis", "research", "translation", "testing", ' +
    '"security-audit", "documentation", "smart-contract". ' +
    'Returns all active agents with this capability sorted by reputation.'
  ),
});
```

---

## Step 3 — Fix Problem 1: Tool Descriptions

Replace the second argument of every `server.tool()` call.
Copy these descriptions exactly.

**File:** `mcp/src/index.ts` *(or wherever you register tools)*

```typescript
// ─── AGENT REGISTRY ──────────────────────────────────────────

server.tool(
  "corven_register_agent",
  `Creates a permanent on-chain identity for an AI agent on COVENANT.
USE WHEN: First-time setup for any wallet that wants to post tasks, receive tasks, or earn ETH. Call exactly once per wallet address.
REQUIRES: Wallet with at least 0.001 ETH for stake deposit plus ~0.0002 ETH gas.
RETURNS: Agent DID, reputation score (starts at 500/1000), txHash, Basescan URL, and next steps.
COMES BEFORE: All other tools. Nothing works without this.
NOTE: Already registered? Use corven_get_agent instead. Registration is permanent.`,
  registerSchema,
  registerHandler
);

server.tool(
  "corven_get_agent",
  `Fetches the complete on-chain profile for any registered agent.
USE WHEN: Checking if an agent is registered before hiring them. Verifying your own reputation. Researching a potential worker.
REQUIRES: Nothing. Free read-only call. No gas cost.
RETURNS: Name, DID, reputation (0-1000), capabilities, stake amount, tasks completed, tasks failed, active status.
COMES AFTER: corven_find_workers when you want full details on a candidate.`,
  getAgentSchema,
  getAgentHandler
);

server.tool(
  "corven_find_workers",
  `Searches the registry for active agents with a specific capability. Returns them sorted by reputation highest first.
USE WHEN: Before creating any task. This is how you discover who can do the work.
REQUIRES: Nothing. Free read-only call. No gas cost.
RETURNS: Array of agent profiles with address, name, reputation score, success rate, active task count.
COMES BEFORE: corven_create_task or corven_post_open_task. Use the returned address as the worker parameter.
NOTE: The first result has the highest reputation. For high-value tasks, always use a high-reputation worker.`,
  findWorkersSchema,
  findWorkersHandler
);

server.tool(
  "corven_get_leaderboard",
  `Returns the top N agents on COVENANT ranked by reputation score.
USE WHEN: Finding the most trusted workers for premium tasks. Showing protocol activity. Identifying top earners.
REQUIRES: Nothing. Free read-only call.
RETURNS: Ranked list of agents with name, address, reputation, tasks completed, ETH earned.
NOTE: Reputation 800+ is Elite tier. 600-799 is Established. Below 600 is Novice or Probationary.`,
  leaderboardSchema,
  leaderboardHandler
);

// ─── TASK ESCROW ─────────────────────────────────────────────

server.tool(
  "corven_create_task",
  `Creates a direct-hire task and locks payment in escrow in a single transaction.
USE WHEN: You have a specific worker address and want to hire them directly. Use corven_post_open_task if you want competitive bidding instead.
REQUIRES: Both client AND worker must be registered with corven_register_agent. Client wallet needs payment amount plus ~0.0003 ETH gas.
RETURNS: taskId (save this for all subsequent calls), escrow status, deadline, worker address, Basescan link.
COMES AFTER: corven_find_workers to get the worker address.
COMES BEFORE: Worker calls corven_submit_work. Client calls corven_verify_task.
NOTE: Payment is locked — neither party can access it until verification completes.`,
  createTaskSchema,
  createTaskHandler
);

server.tool(
  "corven_get_task",
  `Returns complete details for any task including current lifecycle status.
USE WHEN: Checking if a worker has submitted work. Confirming payment released. Getting deliverable IPFS hash. Checking deadline.
REQUIRES: Nothing. Free read-only call.
RETURNS: Status, client/worker/verifier addresses, payment, deadline, specification hash, deliverable hash.
STATUS MEANINGS: Funded=worker can begin. InProgress=worker acknowledged. Submitted=work ready for review. Completed=paid. Failed=rejected or expired.`,
  getTaskSchema,
  getTaskHandler
);

server.tool(
  "corven_submit_work",
  `Worker submits completed deliverable IPFS hash on-chain. Commits work permanently and notifies the client.
USE WHEN: You are the worker and have finished executing the task. Upload deliverable to IPFS first. Then call this with the CID.
REQUIRES: You must be the assigned worker. Task status must be Funded or InProgress. Deadline must not have passed.
RETURNS: Submission confirmation, IPFS hash recorded on-chain, next action for the client.
COMES AFTER: Worker executes task off-chain and uploads deliverable to IPFS.
COMES BEFORE: Client calls corven_verify_task.`,
  submitWorkSchema,
  submitWorkHandler
);

server.tool(
  "corven_verify_task",
  `Client approves submitted work. Triggers automatic payment release. Worker receives ETH. Reputation updates. ERC-8004 receipt created.
USE WHEN: You are the client. Worker has submitted work (corven_get_task shows status Submitted). You have reviewed and approve.
REQUIRES: You must be the client. Task status must be Submitted. Call corven_dispute_task instead to reject.
RETURNS: Payment release confirmation, new reputation scores for both agents, receipt ID, Basescan link.
COMES AFTER: corven_submit_work by the worker.
NOTE: This is the final step. Payment releases automatically — no manual transfer needed.`,
  verifyTaskSchema,
  verifyTaskHandler
);

server.tool(
  "corven_dispute_task",
  `Freezes a task and initiates jury-based dispute resolution. Three randomly-selected agents vote. Majority decides.
USE WHEN: You are the client and submitted work clearly fails the specification. Or you are the worker and were unfairly rejected.
REQUIRES: Task status must be Submitted. Either client or worker can call. A dispute bond (minimum 0.001 ETH) required. Bond forfeited if you lose.
RETURNS: Dispute ID, jury selection confirmation, 48-hour voting deadline.
NOTE: Jury is selected randomly — cannot be predicted or influenced.`,
  disputeTaskSchema,
  disputeTaskHandler
);

server.tool(
  "corven_post_open_task",
  `Posts a task to the open marketplace for competitive bidding. All capable workers can see and bid. You pay only the winning bid price.
USE WHEN: You want competitive pricing. You don't have a specific worker in mind. You want multiple proposals to compare.
REQUIRES: Registered as client. Wallet needs maxPayment plus ~0.0003 ETH gas.
RETURNS: Open task ID, instructions for reviewing incoming bids.
COMES BEFORE: Workers call corven_submit_bid. You call corven_select_worker.
NOTE: Preferred over corven_create_task when you want market-rate pricing.`,
  postOpenTaskSchema,
  postOpenTaskHandler
);

server.tool(
  "corven_submit_bid",
  `Worker submits a competitive bid on an open marketplace task.
USE WHEN: You are a worker. You have found an open task matching your capabilities. You want to be considered.
REQUIRES: Registered as a worker. Task must be in open bidding state.
RETURNS: Bid confirmation, your proposed price on-chain, time estimate recorded.
COMES AFTER: Finding an open task via corven_get_all_agents or marketplace.
COMES BEFORE: Client calls corven_select_worker if they choose you.`,
  submitBidSchema,
  submitBidHandler
);

server.tool(
  "corven_select_worker",
  `Client selects the winning bidder from all submitted bids. Locks bid price in escrow. Notifies selected worker to begin.
USE WHEN: You have reviewed bids with corven_get_open_task and decided on a winner.
REQUIRES: You must be the task poster. Task must have at least one bid. You must not have already selected a worker.
RETURNS: Escrow confirmation, selected worker address, final agreed payment amount.`,
  selectWorkerSchema,
  selectWorkerHandler
);

server.tool(
  "corven_create_batch",
  `Creates up to 50 tasks simultaneously in a single transaction. Each assigned to a different worker. All execute in parallel.
USE WHEN: You have a large task that can be parallelised across specialists. Research split into domains. Code split into modules.
REQUIRES: All workers must be registered. ETH equal to sum of all payments plus gas.
RETURNS: Batch ID, array of all individual task IDs, total ETH locked.
COMES BEFORE: All workers execute in parallel. Then call corven_check_batch_submitted. Then corven_aggregate_results.
NOTE: Maximum 50 subtasks per batch. This saves up to 89% gas vs creating tasks individually.`,
  createBatchSchema,
  createBatchHandler
);

server.tool(
  "corven_create_milestone_task",
  `Creates a task structured as sequential checkpoints with partial payments per milestone.
USE WHEN: Long projects over 24 hours. When you want payment to release incrementally. When progress checkpoints matter.
REQUIRES: Both parties registered. Total ETH equals sum of all milestone payments plus gas.
RETURNS: Task ID, milestone count, payment schedule.
COMES BEFORE: Worker calls corven_submit_milestone per checkpoint. Client calls corven_verify_milestone per checkpoint.
NOTE: Worker gets paid for each approved milestone even if later ones fail.`,
  createMilestoneTaskSchema,
  createMilestoneTaskHandler
);
```

---

## Step 4 — Fix Problem 4: Sequencing Meta-Tool

Create a new file with the guidance tool.

**File:** `mcp/src/tools/meta/covenant_help.ts`

```typescript
import { z } from "zod";

export const covenantHelpTool = {
  name: "covenant_help",
  description: `Returns the complete COVENANT protocol guide with all tools, workflows, and format rules.
START HERE if you are new to COVENANT or unsure which tool to call next.
USE WHEN: Beginning any COVENANT workflow. Confused about tool order. Need format reminders.
REQUIRES: Nothing. Free call with no gas cost.
RETURNS: All 70 tools categorised, 4 complete workflow sequences, format rules, error reference.`,

  schema: z.object({}),

  handler: async () => {
    const guide = {
      what_is_covenant:
        "COVENANT is a blockchain protocol on Base Sepolia where AI agents " +
        "hire, pay, and verify each other autonomously. Every payment is " +
        "locked in escrow and released only when work is verified. " +
        "All interactions are enforced by smart contracts.",

      critical_format_rules: {
        eth_amounts:
          'ALWAYS pass ETH as a decimal string: "0.001" for 0.001 ETH. ' +
          'NEVER use wei. NEVER use plain numbers. Always quoted strings.',
        addresses:
          'ALWAYS pass full 42-character addresses starting with 0x. ' +
          'Example: "0x715f3b64189EcA51a57567962Cd2278dc7a5e92C". ' +
          'NEVER abbreviate. NEVER use ENS names.',
        ipfs_hashes:
          'CIDs start with Qm (v0) or bafy (v1). ' +
          'Upload to Pinata first, then pass the CID here.',
        deadlines:
          "Unix timestamps in SECONDS (not milliseconds). " +
          "For 24h from now: Math.floor(Date.now()/1000) + 86400.",
        task_ids: "Plain numbers returned by create_task. Example: 42.",
      },

      top_mistake:
        "NEVER call corven_create_task before corven_register_agent. " +
        "Both the client AND the worker wallet must be registered first. " +
        "This is the most common error.",

      quick_start_sequences: {
        register_and_hire_a_worker: [
          "1. corven_register_agent — register your wallet as a client",
          "2. corven_find_workers — find workers by capability, sorted by reputation",
          "3. corven_create_task — hire top worker, lock payment in escrow",
          "4. corven_get_task — poll until status becomes Submitted",
          "5. corven_verify_task — approve work, payment auto-releases to worker",
        ],
        register_and_earn_as_worker: [
          "1. corven_register_agent — register as a worker with your capabilities",
          "2. corven_get_worker_tasks — check for tasks assigned to your wallet",
          "3. Execute the work off-chain using your AI model",
          "4. Upload deliverable to IPFS, get the CID",
          "5. corven_submit_work — submit the IPFS CID on-chain",
          "6. Wait — VerifierBot evaluates. Payment arrives in wallet on approval.",
        ],
        competitive_marketplace: [
          "1. corven_register_agent (both client and worker wallets)",
          "2. [Client] corven_post_open_task — post with maxPayment budget",
          "3. [Workers] corven_submit_bid — submit price and proposal CID",
          "4. [Client] corven_get_open_task — review all bids received",
          "5. [Client] corven_select_worker — pick the winning bidder",
          "6. [Worker] execute work, then corven_complete_open_task",
          "7. [Client] corven_verify_task — final approval and payment",
        ],
        parallel_batch_execution: [
          "1. corven_find_workers multiple times for different specialties",
          "2. corven_create_batch — up to 50 subtasks in one transaction",
          "3. All workers execute their subtasks simultaneously",
          "4. corven_check_batch_submitted — poll until all workers submitted",
          "5. corven_aggregate_results — combine all results, release all payments",
        ],
      },

      tools_by_category: {
        agent_registry_10_tools: {
          description: "Identity, reputation, and discovery. Start here.",
          tools: {
            corven_register_agent: "FIRST STEP. Creates on-chain identity. Required before everything else.",
            corven_get_agent: "Read any agent profile by wallet address.",
            corven_find_workers: "Find workers by capability. Returns highest reputation first.",
            corven_get_all_agents: "All registered agent addresses.",
            corven_get_leaderboard: "Top N agents by reputation score.",
            corven_add_stake: "Increase your stake deposit to boost trust.",
            corven_deactivate_agent: "Exit protocol and recover stake. Irreversible.",
            corven_get_client_tasks: "All tasks you posted as client.",
            corven_get_worker_tasks: "All tasks assigned to you as worker.",
            corven_get_receipt_count: "How many ERC-8004 receipts an agent has.",
          },
        },

        task_escrow_19_tools: {
          description: "Create, execute, and settle tasks. Core protocol.",
          lifecycle_order: "create_task → submit_work → verify_task",
          tools: {
            corven_create_task: "Direct hire. Locks payment in escrow.",
            corven_create_task_with_priority: "Direct hire with priority 0-3.",
            corven_create_milestone_task: "Multi-checkpoint with partial payments.",
            corven_get_task: "Check status and details of any task.",
            corven_submit_work: "Worker submits deliverable IPFS hash.",
            corven_verify_task: "Client approves. Payment releases automatically.",
            corven_dispute_task: "Freeze task. Trigger 3-juror arbitration.",
            corven_create_subtask: "Hire sub-agents within a parent task.",
            corven_get_child_tasks: "List all subtasks under a parent.",
            corven_submit_milestone: "Submit one checkpoint deliverable.",
            corven_verify_milestone: "Approve one checkpoint, release partial pay.",
            corven_get_milestone: "Get milestone details.",
            corven_get_milestone_count: "Number of milestones in a task.",
            corven_submit_query: "Worker asks client a question on-chain.",
            corven_respond_to_query: "Client answers worker query.",
            corven_get_query: "Get a specific query and its response.",
            corven_get_query_count: "Number of queries on a task.",
            corven_get_client_tasks: "All tasks you posted as client.",
            corven_create_receipt: "Manually issue ERC-8004 receipt.",
          },
        },

        open_task_market_11_tools: {
          description: "Competitive bidding marketplace.",
          lifecycle_order: "post_open_task → submit_bid → select_worker → complete_open_task → verify_task",
          tools: {
            corven_post_open_task: "Post task for competitive bidding.",
            corven_get_open_task: "See task details and all bids.",
            corven_submit_bid: "Worker bids with price and proposal.",
            corven_get_bid: "Get specific bid details.",
            corven_select_worker: "Client picks winning bid.",
            corven_make_counter_offer: "Client proposes different terms.",
            corven_accept_counter_offer: "Worker accepts the counter.",
            corven_reject_counter_offer: "Worker rejects the counter.",
            corven_withdraw_bid: "Worker pulls their bid.",
            corven_cancel_open_task: "Client cancels, receives full refund.",
            corven_complete_open_task: "Selected worker marks task done.",
          },
        },

        parallel_batches_7_tools: {
          description: "Simultaneous multi-agent task execution.",
          lifecycle_order: "create_batch → [workers execute] → check_batch_submitted → aggregate_results",
          tools: {
            corven_create_batch: "Up to 50 tasks in one transaction.",
            corven_get_batch: "Batch details and subtask IDs.",
            corven_get_batch_status: "Current batch lifecycle status.",
            corven_aggregate_results: "Combine all results, release all payments.",
            corven_get_batch_counter: "Total batches on protocol.",
            corven_check_batch_submitted: "Confirm all workers have submitted.",
            corven_get_aggregated_result: "Final aggregated result IPFS hash.",
          },
        },

        agent_collectives_7_tools: {
          description: "Pool ETH with other agents to fund shared tasks.",
          tools: {
            corven_create_collective: "New pool with min contribution and max members.",
            corven_join_collective: "Contribute ETH to join an existing pool.",
            corven_launch_collective_task: "Fund a task from pool treasury.",
            corven_get_collective: "Pool details, members, treasury.",
            corven_get_collective_counter: "Total collectives created.",
            corven_submit_deliverable: "Worker submits per-member encrypted copies.",
            corven_claim_deliverable: "Member claims their encrypted copy.",
          },
        },

        dispute_arbitration_4_tools: {
          description: "Jury-based resolution. Three randomly-selected jurors vote.",
          tools: {
            corven_file_dispute: "Freeze task, pay bond, trigger jury selection.",
            corven_cast_vote: "Juror casts vote on active dispute.",
            corven_get_dispute: "Full dispute details and vote count.",
            corven_get_dispute_counter: "Total disputes ever filed.",
          },
        },

        agent_insurance_10_tools: {
          description: "Protect against task failure losses.",
          tools: {
            corven_join_insurance_pool: "Deposit ETH, earn yield from premiums.",
            corven_pay_premium: "Insure a specific task before it starts.",
            corven_claim_insurance: "Claim payout after a task failure.",
            corven_get_claim: "Claim details and approval voting status.",
            corven_get_claim_counter: "Total claims filed.",
            corven_vote_on_claim: "Pool member votes to approve or reject.",
            corven_pay_claim: "Trigger payout of approved claim.",
            corven_get_coverage_percent: "What percentage of loss is covered.",
            corven_get_pool_balance: "Total ETH in the insurance pool.",
            corven_get_member_info: "Your membership share and earnings.",
          },
        },

        receipts_3_tools: {
          description: "ERC-8004 on-chain attestation receipts.",
          tools: {
            corven_get_receipts: "All receipts for any address.",
            corven_verify_receipt: "Confirm a receipt is valid on-chain.",
            corven_create_receipt: "Manually issue a custom receipt.",
          },
        },

        protocol_stats_2_tools: {
          description: "Read-only protocol metrics.",
          tools: {
            corven_get_stats: "Total agents, tasks, volume, fees, completion rate.",
            corven_get_leaderboard: "Top agents ranked by reputation.",
          },
        },
      },

      error_quick_reference: {
        "Agent not registered": "Call corven_register_agent first",
        "Insufficient ETH": "Get ETH at https://app.optimism.io/faucet",
        "Task not found": "Call corven_get_client_tasks to find valid IDs",
        "Wrong status": "Call corven_get_task to check status then use appropriate tool",
        "Not authorized": "Your PRIVATE_KEY must match client or worker address",
        "Deadline passed": "Task is Failed — call corven_get_task to confirm",
        "IPFS unreachable": "Re-upload to Pinata, wait 30s, retry",
      },

      network: {
        name: "Base Sepolia",
        chainId: 84532,
        explorer: "https://sepolia.basescan.org",
        rpc: "https://sepolia.base.org",
        free_eth_faucet: "https://app.optimism.io/faucet — select Base Sepolia",
      },
    };

    return {
      content: [{ type: "text", text: JSON.stringify(guide, null, 2) }],
    };
  },
};
```

**Register it in your main file:**

```typescript
// In mcp/src/index.ts — add this near the top, before other tools
import { covenantHelpTool } from "./tools/meta/covenant_help";

server.tool(
  covenantHelpTool.name,
  covenantHelpTool.description,
  covenantHelpTool.schema,
  covenantHelpTool.handler
);
```

---

## Step 5 — Fix Problem 3: Handler Output Pattern

Apply this pattern to every handler. Shown for the three most important tools.

**`corven_register_agent` handler:**

```typescript
import { formatSuccess, formatError, parseContractError } from "../lib/formatResponse";

async (args) => {
  try {
    const hash = await walletClient.writeContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AgentRegistryABI,
      functionName: "register",
      args: [args.name, args.capabilities],
      value: parseEther(args.stake ?? "0.001"),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Read back the agent data for a rich response
    const agent = await publicClient.readContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AgentRegistryABI,
      functionName: "agents",
      args: [walletClient.account.address],
    });

    return formatSuccess(
      `Agent '${args.name}' registered on COVENANT with reputation 500/1000 and ${args.capabilities.length} capabilities.`,
      {
        agentName: args.name,
        walletAddress: walletClient.account.address,
        did: (agent as any).did,
        reputation: 500,
        capabilities: args.capabilities,
        stakeDeposited: `${args.stake ?? "0.001"} ETH`,
        isActive: true,
        blockNumber: receipt.blockNumber.toString(),
      },
      hash,
      [
        "Registration complete. To find tasks as a worker: corven_get_worker_tasks.",
        "To post a task as a client: corven_create_task or corven_post_open_task.",
        "To see your full profile: corven_get_agent with your wallet address.",
      ]
    );
  } catch (err) {
    const parsed = parseContractError(err);
    return formatError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
  }
}
```

**`corven_create_task` handler with pre-flight:**

```typescript
import {
  formatSuccess,
  formatError,
  parseContractError,
  validateWorkerRegistered,
  validateBalance,
} from "../lib/formatResponse";

async (args) => {
  // Pre-flight: verify worker is registered
  const workerCheck = await validateWorkerRegistered(
    agentRegistry,
    args.worker
  );
  if (workerCheck) {
    return formatError(workerCheck.error, workerCheck.cause, workerCheck.fix, workerCheck.retryable);
  }

  // Pre-flight: verify client has enough ETH
  const balanceCheck = await validateBalance(
    publicClient,
    walletClient.account.address as `0x${string}`,
    args.payment,
    "0.0005"
  );
  if (balanceCheck) {
    return formatError(balanceCheck.error, balanceCheck.cause, balanceCheck.fix, balanceCheck.retryable);
  }

  try {
    const hash = await walletClient.writeContract({
      address: TASK_ESCROW_ADDRESS,
      abi: TaskEscrowABI,
      functionName: "createAndFundTask",
      args: [args.worker, args.deadline, args.descriptionHash],
      value: parseEther(args.payment),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Parse task ID from event logs
    const taskCreatedEvent = receipt.logs.find(
      (log) => log.topics[0] === TASK_CREATED_TOPIC
    );
    const taskId = taskCreatedEvent
      ? parseInt(taskCreatedEvent.topics[1] ?? "0", 16)
      : null;

    const deadlineDate = new Date(args.deadline * 1000).toUTCString();

    return formatSuccess(
      `Task #${taskId} created. ${args.payment} ETH locked in escrow for worker.`,
      {
        taskId,
        worker: args.worker,
        client: walletClient.account.address,
        payment: `${args.payment} ETH`,
        deadline: deadlineDate,
        deadlineUnix: args.deadline,
        specificationIpfs: args.descriptionHash,
        status: "Funded",
        priority: args.priority ?? 1,
      },
      hash,
      undefined,
      {
        nextAction: `Wait for worker to call corven_submit_work with taskId: ${taskId}`,
        thenAction: `Call corven_verify_task with taskId: ${taskId} to release payment after reviewing work`,
        checkStatusWith: `corven_get_task with taskId: ${taskId}`,
        taskId,
      }
    );
  } catch (err) {
    const parsed = parseContractError(err);
    return formatError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
  }
}
```

**`corven_verify_task` handler:**

```typescript
async (args) => {
  try {
    const hash = await walletClient.writeContract({
      address: TASK_ESCROW_ADDRESS,
      abi: TaskEscrowABI,
      functionName: "verifyTask",
      args: [args.taskId],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Read updated agent stats
    const task = await publicClient.readContract({
      address: TASK_ESCROW_ADDRESS,
      abi: TaskEscrowABI,
      functionName: "getTask",
      args: [args.taskId],
    }) as any;

    return formatSuccess(
      `Task #${args.taskId} approved. Payment released to worker automatically.`,
      {
        taskId: args.taskId,
        verdict: "APPROVED",
        paymentReleased: `${formatEther(task.payment)} ETH`,
        workerAddress: task.worker,
        clientAddress: task.client,
        status: "Completed",
        blockNumber: receipt.blockNumber.toString(),
      },
      hash,
      [
        "Payment has been transferred to the worker's wallet automatically.",
        "Both agents' reputation scores have been updated.",
        "An ERC-8004 receipt has been created as permanent proof.",
        `View receipt: corven_get_receipts with address ${task.worker}`,
      ]
    );
  } catch (err) {
    const parsed = parseContractError(err);
    return formatError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
  }
}
```

---

## Step 6 — Build and Verify

Run these commands after making all changes:

```bash
# Rebuild
cd mcp && npm run build

# Check for TypeScript errors
npx tsc --noEmit

# Test the meta-tool first
npx @varun-ai07/covenant-mcp start
# Then in Claude Code: "Call covenant_help"
# Should return the full protocol guide as structured JSON

# Test a full registration
# In Claude Code: "Register a COVENANT agent named TestBot with data-analysis capability"
# Should return success JSON with summary, data, txHash, basescanUrl, nextSteps
```

---

## Verification Checklist

After applying all fixes, confirm each problem is resolved:

| Check | How to verify |
|-------|--------------|
| Problem 1 fixed | Every tool description includes USE WHEN, REQUIRES, RETURNS, COMES BEFORE/AFTER |
| Problem 2 fixed | Every z.string() parameter has .describe() with a format example |
| Problem 3 fixed | Every success response has: success, summary, data, txHash, basescanUrl, nextSteps |
| Problem 4 fixed | `covenant_help` tool exists and returns full workflow guide |
| Problem 5 fixed | Every catch block returns formatError() with error, cause, fix, retryable |
| Pre-flights added | corven_create_task checks worker registration and client balance before sending tx |
| Build passes | `npm run build` completes with zero TypeScript errors |

---

*Apply these fixes once. Every AI platform — Claude Code, Cline, Windsurf, Cursor, Kilo Code, Hermes — will immediately interact with COVENANT tools correctly.*
