/**
 * ReceiptVerifier MCP Tools
 *
 * get_receipts     — Fetch all receipts for an address
 * verify_receipt   — Verify a specific receipt on-chain
 */
import { z } from "zod";
import { type Address, isAddress } from "viem";
import { loadAbi, CONTRACTS } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { RECEIPT_TYPE } from "../types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ABI = loadAbi("ReceiptVerifier");

// Input validation schemas
const getReceiptsSchema = z.object({
  address: z.string().refine(isAddress, { message: "Invalid Ethereum address" })
});

const verifyReceiptSchema = z.object({
  receiptId: z.number().int().positive()
});

export function registerReceiptTools(server: McpServer): void {
  // ──────────────────────────────────────────────────────────────
  // get_receipts
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "get_receipts",
    {
      title: "Get Receipts for Address",
      description:
        "Retrieve all ERC-8004 attestation receipts issued to or by an address. " +
        "Returns receipt IDs, issuers, counterparty, type, task reference, and validity.",
      inputSchema: {
        address: z.string().describe("Ethereum address to look up receipts for"),
      },
    },
    async ({ address }) => {
      try {
        // Validate input
        const validationResult = getReceiptsSchema.safeParse({ address });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated address
        const validatedAddress = validationResult.data.address;
        // Read receipts for this address from the ReceiptVerifier contract
        const data = await readContract(
          CONTRACTS.ReceiptVerifier,
          ABI,
          "getReceipts",
          [validatedAddress as Address]
        );

        // Enrich receipt types with human-readable labels
        const receipts = Array.isArray(data)
          ? (data as any[]).map((r) => ({
              ...r,
              typeLabel: RECEIPT_TYPE[r.interactionType] ?? `Unknown(${r.interactionType})`,
            }))
          : data;

        return formatReadResult(
          { address, count: Array.isArray(data) ? data.length : 0, receipts },
          `Receipts for ${address}`
        );
      } catch (e) {
        return formatError(e);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // verify_receipt
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "verify_receipt",
    {
      title: "Verify a Receipt",
      description:
        "Check whether a specific ERC-8004 receipt is valid on-chain. " +
        "Returns the receipt details and validity status.",
      inputSchema: {
        receiptId: z.number().describe("Numeric receipt ID"),
      },
    },
    async ({ receiptId }) => {
      try {
        // Validate input
        const validationResult = verifyReceiptSchema.safeParse({ receiptId });
        if (!validationResult.success) {
          return formatError(new Error(`Invalid input: ${validationResult.error.issues.map((e: any) => e.message).join(", ")}`));
        }

        // Use validated receiptId
        const validatedReceiptId = validationResult.data.receiptId;
        const data = await readContract(
          CONTRACTS.ReceiptVerifier,
          ABI,
          "getReceipt",
          [BigInt(receiptId)]
        );

        const enriched = {
          ...(data as any),
          typeLabel:
            RECEIPT_TYPE[(data as any).interactionType] ??
            `Unknown(${(data as any).interactionType})`,
        };

        return formatReadResult(enriched, `Receipt #${receiptId}`);
      } catch (e) {
        return formatError(e);
      }
    }
  );
}
