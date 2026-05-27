/**
 * Revision MCP Tools
 *
 * corven_request_revision — Client requests changes (free)
 * corven_submit_revision — Worker submits revised work
 * corven_get_revisions — Get revision history
 * corven_can_revise — Check if more revisions allowed
 */
import { z } from "zod";
import { type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { executeOrPrepare, readContract } from "../handlers/wallet.js";
import { formatTxResult, formatReadResult } from "../handlers/transactions.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import { ethAddress, ipfsCid, taskId as taskIdSchema } from "../lib/schemaHelpers.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const REVISION_ABI = loadAbi("RevisionManager");

function getRevisionManagerAddress(): Address {
  const addr = CONTRACTS.RevisionManager;
  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    throw new Error("RevisionManager not deployed. Set REVISION_MANAGER env var.");
  }
  return addr;
}

export function registerRevisionTools(server: McpServer) {
  server.registerTool(
    "corven_request_revision",
    {
      title: "Request Revision",
      description:
        "Client requests changes to submitted work. Free — no cost to request revisions.\n" +
        "USE WHEN: Worker submitted work that needs changes. You want to request modifications.\n" +
        "REQUIRES: Task must have revision allowed. Max 3 revisions per task.\n" +
        "RETURNS: Revision number, feedback hash, and confirmation.\n" +
        "COMES AFTER: corven_verify_task (client reviewed work).\n" +
        "COMES BEFORE: Worker calls corven_submit_revision with changes.\n" +
        "NOTE: Revisions are free. Only dispute costs ETH (stake slashing).",
      inputSchema: {
        taskId: taskIdSchema,
        feedbackHash: ipfsCid.describe("IPFS hash of detailed feedback"),
      },
    },
    async (params) => {
      try {
        const { taskId, feedbackHash } = params;

        const addr = getRevisionManagerAddress();
        const result = await executeOrPrepare(
          addr,
          REVISION_ABI,
          "requestRevision",
          [taskId, feedbackHash]
        );

        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  server.registerTool(
    "corven_submit_revision",
    {
      title: "Submit Revision",
      description:
        "Worker submits revised work after client feedback.\n" +
        "USE WHEN: You received revision feedback and have made changes.\n" +
        "REQUIRES: A revision must have been requested. You must be the worker (not the requester).\n" +
        "RETURNS: Revision number, new deliverable hash, and confirmation.\n" +
        "COMES AFTER: corven_request_revision (client requested changes).\n" +
        "COMES BEFORE: Client reviews revised work with corven_verify_deep or corven_verify_task.",
      inputSchema: {
        taskId: taskIdSchema,
        newHash: ipfsCid.describe("IPFS hash of revised deliverable"),
      },
    },
    async (params) => {
      try {
        const { taskId, newHash } = params;

        const addr = getRevisionManagerAddress();
        const result = await executeOrPrepare(
          addr,
          REVISION_ABI,
          "submitRevision",
          [taskId, newHash]
        );

        return formatTxResult(result);
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  server.registerTool(
    "corven_get_revisions",
    {
      title: "Get Revision History",
      description:
        "Get all revisions for a task.\n" +
        "USE WHEN: Reviewing revision history before making a decision.\n" +
        "REQUIRES: Task ID.\n" +
        "RETURNS: Array of revisions with numbers, feedback, hashes, and timestamps.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async (params) => {
      try {
        const { taskId } = params;
        const addr = getRevisionManagerAddress();
        const revisions = await readContract(
          addr,
          REVISION_ABI,
          "getRevisions",
          [taskId]
        );

        return formatReadResult(
          { taskId, revisionCount: (revisions as any[]).length, revisions },
          `Revisions for Task #${taskId}`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  server.registerTool(
    "corven_can_revise",
    {
      title: "Check If Revisions Allowed",
      description:
        "Check if a task can still receive revisions.\n" +
        "USE WHEN: Checking if more revisions are possible.\n" +
        "REQUIRES: Task ID.\n" +
        "RETURNS: Boolean indicating if revisions are allowed and remaining count.",
      inputSchema: {
        taskId: taskIdSchema,
      },
    },
    async (params) => {
      try {
        const { taskId } = params;
        const addr = getRevisionManagerAddress();
        const canRevise = await readContract(
          addr,
          REVISION_ABI,
          "canRevise",
          [taskId]
        );
        const count = await readContract(
          addr,
          REVISION_ABI,
          "getRevisionCount",
          [taskId]
        );

        return formatReadResult(
          { taskId, canRevise, revisionCount: Number(count) },
          `Revision Status for Task #${taskId}`
        );
      } catch (e: unknown) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
