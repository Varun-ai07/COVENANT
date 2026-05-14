/**
 * Transaction utilities: gas estimation, multicall, result formatting.
 */
import { formatEther, type Address, type Abi, type Hash } from "viem";
import { getPublicClient, getExplorerTxUrl, CHAIN } from "../config.js";
import { sanitizeErrorMessage } from "../schemas.js";
import type { TxResult, ToolResult } from "../types.js";

// ============================================================
// Format tx result for MCP tool response
// ============================================================

export function formatTxResult(result: TxResult): ToolResult {
  if (result.status === "success") {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              success: true,
              txHash: result.txHash,
              explorer: getExplorerTxUrl(result.txHash),
              blockNumber: result.blockNumber.toString(),
              gasUsed: result.gasUsed.toString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (result.status === "prepared") {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              prepared: true,
              to: result.to,
              data: result.data,
              value: result.value.toString(),
              chainId: result.chainId,
              nonce: result.nonce,
              expiresAt: result.expiresAt,
              instruction:
                "Sign this calldata with your wallet and broadcast to the chain. " +
                "Validate nonce and expiry before signing.",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Error
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${result.error}${result.reason ? `\nReason: ${result.reason}` : ""}`,
      },
    ],
    isError: true,
  };
}

// ============================================================
// Format read result for MCP tool response
// ============================================================

export function formatReadResult(data: any, label?: string): ToolResult {
  // Convert BigInts to strings for JSON serialization
  const serialized = JSON.parse(
    JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return {
    content: [
      {
        type: "text" as const,
        text: label
          ? `${label}:\n${JSON.stringify(serialized, null, 2)}`
          : JSON.stringify(serialized, null, 2),
      },
    ],
  };
}

// ============================================================
// Format error for MCP tool response
// ============================================================

export function formatError(error: unknown): ToolResult {
  const msg = error instanceof Error ? error.message : String(error);
  const sanitized = sanitizeErrorMessage(msg);
  return {
    content: [{ type: "text" as const, text: `Error: ${sanitized}` }],
    isError: true,
  };
}
