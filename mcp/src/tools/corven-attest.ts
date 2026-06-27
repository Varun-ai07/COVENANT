/**
 * corven_attest — Receipts and attestations via CovenantAttestation contract
 */
import { z } from "zod";
import { keccak256, toBytes, type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount, getPublicClient } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ATTESTATION_ABI = loadAbi("CovenantAttestation");
const ATTESTATION_ADDRESS = CONTRACTS.CovenantAttestation as Address;

const SCHEMA_HASH = keccak256(toBytes("COVENANT_TASK_COMPLETION"));

const actionSchema = z.enum([
  "create", "verify", "batch", "get",
]);

const schema = z.object({
  action: actionSchema,
  issuer: z.string().optional(),
  counterparty: z.string().optional(),
  interactionType: z.union([z.number(), z.string()]).optional(),
  dataHash: z.string().optional(),
  receiptId: z.string().optional(),
  address: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  dataHashes: z.array(z.string()).optional(),
  expiresAt: z.number().optional(),
  confirm: z.boolean().optional().default(false).describe('NEVER set this yourself. ALWAYS ask the user first. Show the exact ETH cost and what will happen. Only set to true AFTER the user explicitly says yes.'),
});

function parseReceiptId(input: string): `0x${string}` {
  if (input.startsWith("0x") && input.length === 66) return input as `0x${string}`;
  return keccak256(toBytes(input)) as `0x${string}`;
}

export function registerAttestTools(server: McpServer): void {
  server.registerTool(
    "corven_attest",
    {
      title: "Attestation Manager",
      description:
        "ERC-8004 attestation receipts to prove task completion on-chain.\n\n" +
        "ACTIONS:\n" +
        "  create — Issue an attestation receipt (requires counterparty, dataHash)\n" +
        "  verify — Verify a specific receipt by ID (requires receiptId)\n" +
        "  batch — Issue multiple attestations at once (requires subjects, dataHashes)\n" +
        "  get — List all attestation IDs for an address (requires address)\n\n" +
        "TYPES: 0=TaskCompleted, 1=AgentVerified, 2=CapabilityProven, 3=ReputationVerified, 4=DisputeResolved, 5=InsuranceClaimed\n\n" +
        "WHEN TO USE: When you need cryptographic proof of task completion or agent verification.\n\n" +
        "NEXT STEP: Share receipt with corven_reputation({ action: 'export' }) for cross-platform trust.\n\n" +
        "CRITICAL SAFETY: The AI must NEVER auto-set confirm=true. ALWAYS present the cost summary to the user first and wait for explicit approval. This is real money. Violating this is unacceptable.\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "create") {
          const counterparty = args.counterparty as string;
          const dataHash = args.dataHash as string;
          if (!counterparty || !dataHash) {
            return formatStructuredError("Missing required fields.", "create requires counterparty and dataHash.", "Provide counterparty (address) and dataHash (hash string).", true);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: "Issue attestation receipt on-chain",
              counterparty,
              schemaHash: SCHEMA_HASH,
              dataHash,
              toProceed: "Call corven_attest again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const expiresAt = args.expiresAt || Math.floor(Date.now() / 1000) + 86400 * 365;
          const dataHashBytes = dataHash.startsWith("0x") ? dataHash as `0x${string}` : keccak256(toBytes(dataHash));
          const result = await executeOrPrepare(
            ATTESTATION_ADDRESS,
            ATTESTATION_ABI,
            "attest",
            [counterparty as Address, SCHEMA_HASH, dataHashBytes, expiresAt],
            undefined,
            "CovenantAttestation"
          );
          return formatTxResult(result);
        }

        if (action === "verify") {
          const receiptId = args.receiptId as string;
          if (!receiptId) {
            return formatStructuredError("Missing required field.", "verify requires receiptId.", "Provide the attestation ID (bytes32 hex or string).", true);
          }
          const id = parseReceiptId(receiptId);
          const [valid, attestation] = await readContract(
            ATTESTATION_ADDRESS, ATTESTATION_ABI, "verify", [id]
          ) as [boolean, any];
          return formatReadResult({
            attestationId: id,
            valid,
            issuer: attestation.issuer,
            subject: attestation.subject,
            schemaHash: attestation.schemaHash,
            dataHash: attestation.dataHash,
            issuedAt: Number(attestation.issuedAt),
            expiresAt: Number(attestation.expiresAt),
            revoked: attestation.revoked,
          }, valid ? "Attestation Valid" : "Attestation Invalid");
        }

        if (action === "batch") {
          const subjects = (args.subjects || []) as string[];
          const dataHashes = (args.dataHashes || []) as string[];
          if (subjects.length === 0 || dataHashes.length === 0 || subjects.length !== dataHashes.length) {
            return formatStructuredError("Invalid batch input.", "subjects and dataHashes must be non-empty arrays of equal length.", "Provide matching arrays of addresses and data hashes.", true);
          }
          if (!args.confirm) {
            return formatReadResult({
              confirmationRequired: true,
              action: `Issue ${subjects.length} attestation(s) on-chain`,
              subjects,
              toProceed: "Call corven_attest again with confirm: true",
            }, "CONFIRMATION REQUIRED");
          }
          const expiresAt = args.expiresAt || Math.floor(Date.now() / 1000) + 86400 * 365;
          const hashBytes = dataHashes.map(h => (h.startsWith("0x") ? h : keccak256(toBytes(h))) as `0x${string}`);
          const result = await executeOrPrepare(
            ATTESTATION_ADDRESS,
            ATTESTATION_ABI,
            "attestBatch",
            [subjects as Address[], SCHEMA_HASH, hashBytes, expiresAt],
            undefined,
            "CovenantAttestation"
          );
          return formatTxResult(result);
        }

        if (action === "get") {
          const addr = (args.address || getAccount()?.address) as string;
          if (!addr) {
            return formatStructuredError("Missing required field.", "get requires address.", "Provide an agent address.", true);
          }
          const ids = await readContract(
            ATTESTATION_ADDRESS, ATTESTATION_ABI, "getAgentAttestations", [addr as Address]
          ) as `0x${string}`[];
          const count = await readContract(
            ATTESTATION_ADDRESS, ATTESTATION_ABI, "attestationCount", []
          ) as bigint;
          return formatReadResult({
            address: addr,
            totalAttestations: Number(count),
            attestationIds: ids,
          }, `Attestations for ${addr}`);
        }

        return formatStructuredError("Unknown action.", "Valid actions: create, verify, batch, get.", "Pass a valid action string.", true);
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
