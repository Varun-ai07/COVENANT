/**
 * Transaction utilities: gas estimation, multicall, result formatting.
 */
import { formatEther, type Address, type Abi, type Hash } from "viem";
import { getPublicClient, getExplorerTxUrl, CHAIN } from "../config.js";
import { sanitizeErrorMessage } from "../schemas.js";
import type { TxResult, ToolResult } from "../types.js";

// ============================================================
// Format tx result for MCP tool response (Human-readable text)
// ============================================================

export function formatTxResult(result: TxResult): ToolResult {
  if (result.status === "success") {
    const etherUrl = getExplorerTxUrl(result.txHash);
    const gasEth = formatEther(BigInt(result.gasUsed) * BigInt(10**9)); // Rough estimate at 1 gwei

    return {
      content: [
        {
          type: "text" as const,
          text: `Transaction successful.\n\nTx: ${result.txHash}\nBlock: ${result.blockNumber}\nGas used: ${result.gasUsed}\n\nView on explorer: ${etherUrl}`,
        },
      ],
    };
  }

  if (result.status === "prepared") {
    const valueEth = result.value !== undefined ? formatEther(BigInt(result.value)) : "0";
    const expiresAtStr = result.expiresAt ? new Date(result.expiresAt * 1000).toISOString() : "N/A";

    return {
      content: [
        {
          type: "text" as const,
          text: `Transaction prepared for signing.\n\nTo: ${result.to}\nValue: ${valueEth} ETH${result.chainId ? `\nChain ID: ${result.chainId}` : ""}${result.nonce !== undefined ? `\nNonce: ${result.nonce}` : ""}\nExpires: ${expiresAtStr}\n\nSign and broadcast this transaction from your wallet.`,
        },
      ],
    };
  }

  // Error
  return {
    content: [
      {
        type: "text" as const,
        text: `Transaction failed: ${result.error}${result.reason ? ` — ${result.reason}` : ""}`,
      },
    ],
    isError: true,
  };
}

// ============================================================
// Format read result for MCP tool response (Human-readable text)
// ============================================================

export function formatReadResult(data: any, label?: string): ToolResult {
  // Convert BigInts to appropriate values
  const processed = processReadData(data);

  // Generate human-readable text
  const text = formatReadableText(processed, label);

  return {
    content: [
      {
        type: "text" as const,
        text: text,
      },
    ],
  };
}

/**
 * Process data to convert BigInts and format nested structures
 */
function processReadData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === "bigint") return data.toString();
  if (Array.isArray(data)) return data.map(processReadData);
  if (typeof data === "object") {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = processReadData(value);
    }
    return result;
  }
  return data;
}

/**
 * Format data as human-readable text
 */
function formatReadableText(data: any, label?: string): string {
  const lines: string[] = [];

  if (label) {
    lines.push(label);
    lines.push("");
  }

  if (Array.isArray(data)) {
    // Handle tuple arrays from Solidity
    if (data.length > 0 && typeof data[0] === "object") {
      data.forEach((item, i) => {
        lines.push(formatObjectBrief(item, i));
      });
    } else if (data.every(v => typeof v !== "object")) {
      // Simple array
      lines.push(data.map((v, i) => `[${i}] ${formatValue(v)}`).join("\n"));
    } else {
      // Mixed array - format each item
      data.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          lines.push(`[${i}] ${formatObjectBrief(item)}`);
        } else {
          lines.push(`[${i}] ${formatValue(item)}`);
        }
      });
    }
  } else if (typeof data === "object" && data !== null) {
    lines.push(formatObjectBrief(data));
  } else {
    lines.push(formatValue(data));
  }

  return lines.join("\n");
}

/**
 * Format an object as brief human-readable text
 */
function formatObjectBrief(obj: any, index?: number): string {
  if (!obj || typeof obj !== "object") return String(obj);

  const parts: string[] = [];

  // Common field mappings for better readability
  const fieldLabels: Record<string, string> = {
    // Agent
    did: "DID",
    wallet: "Wallet",
    reputation: "Reputation",
    isActive: "Active",
    tasksCompleted: "Tasks Done",
    tasksFailed: "Tasks Failed",
    stakedAmount: "Stake",
    registeredAt: "Registered",
    lastTaskAt: "Last Task",
    name: "Name",
    totalValueTransacted: "Total Volume",
    capabilities: "Capabilities",
    // Task
    client: "Client",
    worker: "Worker",
    payment: "Payment",
    deadline: "Deadline",
    descriptionHash: "Description",
    deliverableHash: "Deliverable",
    status: "Status",
    priority: "Priority",
    createdAt: "Created",
    completedAt: "Completed",
    statusLabel: "Status",
    usesMilestones: "Milestones",
    // Open task
    maxPayment: "Max Payment",
    selectedWorker: "Selected Worker",
    selectedPriceEth: "Selected Price",
    maxPaymentEth: "Max Payment",
    // Bid
    priceEth: "Bid Price",
    timeEstimate: "Time Estimate",
    proposalHash: "Proposal",
    bidAt: "Bid Time",
    bidder: "Bidder",
    // Stats
    totalAgents: "Total Agents",
    totalTasks: "Total Tasks",
    completedTasks: "Completed Tasks",
    totalVolume: "Total Volume",
    totalFees: "Protocol Fees",
    activeAgents: "Active Agents",
    totalFeesEth: "Protocol Fees",
    count: "Count",
    // Misc
    taskId: "Task ID",
    collectiveId: "Collective ID",
    batchId: "Batch ID",
    receiptCount: "Receipts",
    poolBalanceEth: "Pool Balance",
    coveragePercent: "Coverage",
    interactionType: "Type",
    typeLabel: "Type",
    issuer: "Issuer",
    counterparty: "Counterparty",
    dataHash: "Data Hash",
    valid: "Valid",
    // Batch
    taskIds: "Task IDs",
    workers: "Workers",
    totalPayment: "Total Payment",
    aggregationSpec: "Aggregation",
    // Collective
    minContribution: "Min Contribution",
    treasury: "Treasury",
    maxMembers: "Max Members",
    memberCount: "Members",
    members: "Members",
    // Dispute
    disputeId: "Dispute ID",
    inFavorOfWorker: "For Worker",
    votesForWorker: "Votes For Worker",
    votesForClient: "Votes For Client",
    resolved: "Resolved",
  };

  for (const [key, value] of Object.entries(obj)) {
    const label = fieldLabels[key] || formatFieldName(key);
    const formatted = formatValue(value, key);

    // Skip raw hex data that's not useful
    if (key === "did" && typeof value === "string" && value.startsWith("0x") && value.length > 20) {
      parts.push(`${label}: ${value.slice(0, 10)}...${value.slice(-8)}`);
    } else if (key === "capabilities" && Array.isArray(value)) {
      parts.push(`${label}: ${value.join(", ")}`);
    } else if (key === "stakedAmount" && typeof value === "string") {
      try {
        const eth = formatEther(BigInt(value));
        parts.push(`${label}: ${eth} ETH`);
      } catch {
        parts.push(`${label}: ${value}`);
      }
    } else if ((key === "payment" || key === "maxPayment" || key === "totalVolume" || key === "totalFees" || key === "treasury" || key === "minContribution" || key === "totalPayment") && typeof value === "string" && value.length > 10) {
      try {
        const eth = formatEther(BigInt(value));
        parts.push(`${label}: ${eth} ETH`);
      } catch {
        parts.push(`${label}: ${value}`);
      }
    } else if ((key === "deadline" || key === "createdAt" || key === "completedAt" || key === "registeredAt" || key === "lastTaskAt" || key === "bidAt") && value && typeof value === "string" && value !== "0") {
      const ts = BigInt(value);
      const date = new Date(Number(ts) * 1000);
      if (date.getFullYear() > 2000 && date.getFullYear() < 2100) {
        parts.push(`${label}: ${date.toISOString().split(".")[0]} UTC`);
      } else {
        parts.push(`${label}: ${value}`);
      }
    } else if (key === "status" && typeof value === "number") {
      const statusLabels = ["Pending", "InProgress", "Submitted", "Completed", "Disputed", "Cancelled"];
      parts.push(`${label}: ${statusLabels[value] || value}`);
    } else if (key === "isActive") {
      parts.push(`${label}: ${value === 1 || value === true ? "Yes" : "No"}`);
    } else if (key === "milestones" && Array.isArray(value)) {
      parts.push(`${label}: ${value.length} milestones defined`);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      parts.push(`${label}: [nested object]`);
    } else {
      parts.push(`${label}: ${formatted}`);
    }
  }

  const prefix = index !== undefined ? `#${index + 1} — ` : "";
  return prefix + parts.join(" | ");
}

/**
 * Format a field name from camelCase to Title Case
 */
function formatFieldName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/**
 * Format a single value for display
 */
function formatValue(value: any, key?: string): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") {
    // Try to format as ETH if it looks like wei
    if (key && (key.toLowerCase().includes("payment") || key.toLowerCase().includes("stake") || key.toLowerCase().includes("balance"))) {
      try {
        return `${formatEther(value)} ETH`;
      } catch {
        return value.toString();
      }
    }
    return value.toString();
  }
  if (typeof value === "string" && value.startsWith("0x") && value.length === 42) {
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every(v => typeof v !== "object")) {
      return value.join(", ");
    }
    return `[${value.length} items]`;
  }
  return String(value);
}

// ============================================================
// Format error for MCP tool response
// ============================================================

export function formatError(error: unknown): ToolResult {
  const msg = error instanceof Error ? error.message : String(error);
  const sanitized = sanitizeErrorMessage(msg);

  // Make error messages more concise
  let concise = sanitized;
  if (concise.includes("Transaction reverted")) {
    // Extract just the reason if present
    const reasonMatch = concise.match(/reason[:\s]+(.+?)(?:\n|$)/i);
    if (reasonMatch) {
      concise = reasonMatch[1].trim();
    } else {
      concise = "Transaction reverted";
    }
  }

  return {
    content: [{ type: "text" as const, text: `Error: ${concise}` }],
    isError: true,
  };
}
