import { z } from "zod";
import { type Address } from "viem";
import { loadAbi, CONTRACTS, getAccount } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult } from "../handlers/transactions.js";
import { formatStructuredError, parseContractError } from "../lib/formatResponse.js";
import { addressToDid, didToAddress } from "../lib/did.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const REGISTRY_ABI = loadAbi("AgentRegistry");
const VERIFIER_ABI = loadAbi("ReceiptVerifier");

const actionSchema = z.enum(["export", "import", "did"]);

const schema = z.object({
  action: actionSchema,
  address: z.string().optional(),
  jwt: z.string().optional(),
});

export function registerReputationTools(server: McpServer): void {
  server.registerTool(
    "corven_reputation",
    {
      title: "Reputation VCs & DIDs",
      description:
        "Portable reputation credentials on COVENANT — export W3C Verifiable Credentials and DIDs.\n\n" +
        "ACTIONS:\n" +
        "  export — Export reputation as W3C VC JWT (requires address)\n" +
        "  import — Verify and parse a reputation VC (requires jwt)\n" +
        "  did — Get DID document for an agent (requires address)\n\n" +
        "WORKFLOW: export → share JWT → import (cross-platform trust)\n" +
        "DID FORMAT: did:covenant:<address>\n" +
        "VC TYPE: CovenantReputation signed with ES256K\n\n" +
        "WHEN TO USE: When you need portable, verifiable reputation across platforms.\n\n" +
        "NEXT STEP: Share your reputation with other protocols using the exported JWT.\n\n" +
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

        if (action === "export") {
          const addr = args.address || getAccount()?.address;
          if (!addr) {
            return formatStructuredError("No address provided.", "Address is required.", "Provide an Ethereum address.", false);
          }

          const agentData = await readContract(CONTRACTS.AgentRegistry, REGISTRY_ABI, "getAgent", [addr as Address]);
          const agent = agentData as any;

          const totalTasks = agent.tasksCompleted + agent.tasksFailed;
          const successRate = totalTasks > 0 ? Math.round((agent.tasksCompleted / totalTasks) * 1000) / 1000 : 0;
          const averageRating = Math.round((Number(agent.reputation) / 200) * 10) / 10;

          let attestationCount = 0;
          try {
            const receipts = await readContract(CONTRACTS.ReceiptVerifier, VERIFIER_ABI, "getReceiptsByAgent", [addr as Address]);
            attestationCount = Array.isArray(receipts) ? receipts.length : 0;
          } catch { /* not fatal */ }

          return formatReadResult({
            did: addressToDid(addr),
            address: addr,
            reputation: Number(agent.reputation),
            tasksCompleted: Number(agent.tasksCompleted),
            successRate,
            averageRating,
            topCapabilities: agent.capabilities?.slice(0, 5) || [],
            attestationCount,
            memberSince: Number(agent.registeredAt) > 0
              ? new Date(Number(agent.registeredAt) * 1000).toISOString().split("T")[0]
              : "unknown",
            rank: Number(agent.tasksCompleted) >= 500 ? "Top 1%"
              : Number(agent.tasksCompleted) >= 200 ? "Top 5%"
              : Number(agent.tasksCompleted) >= 50 ? "Top 10%"
              : Number(agent.tasksCompleted) >= 10 ? "Established"
              : "Newcomer",
            note: "Full JWT export requires wallet signing. Use corven_export_reputation_vc for signed JWT.",
          }, "Reputation Export");
        }

        if (action === "import") {
          if (!args.jwt) {
            return formatStructuredError("No JWT provided.", "JWT is required.", "Provide a VC JWT string.", false);
          }

          const parts = args.jwt.split(".");
          if (parts.length !== 3) {
            return formatStructuredError("Invalid JWT format.", "Expected 3 parts.", "Use a valid VC JWT from corven_export_reputation_vc.", false);
          }

          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
          const issuerAddress = didToAddress(payload.iss);

          let issuerRegistered = false;
          try {
            await readContract(CONTRACTS.AgentRegistry, REGISTRY_ABI, "getAgent", [issuerAddress as Address]);
            issuerRegistered = true;
          } catch { /* not registered */ }

          return formatReadResult({
            verified: true,
            issuerRegistered,
            issuer: { did: payload.iss, address: issuerAddress },
            credential: payload.vc?.credentialSubject || payload,
          }, "VC Verified and Imported");
        }

        if (action === "did") {
          const addr = args.address || getAccount()?.address;
          if (!addr) {
            return formatStructuredError("No address provided.", "Address is required.", "Provide an Ethereum address.", false);
          }

          const did = addressToDid(addr);
          let agentData: any = undefined;

          try {
            const raw = await readContract(CONTRACTS.AgentRegistry, REGISTRY_ABI, "getAgent", [addr as Address]);
            agentData = {
              capabilities: (raw as any).capabilities,
              reputation: Number((raw as any).reputation),
              tasksCompleted: Number((raw as any).tasksCompleted),
            };
          } catch { /* not registered */ }

          return formatReadResult({
            did,
            address: addr,
            document: {
              "@context": ["https://w3id.org/did/v1"],
              id: did,
              verificationMethod: [{ id: `${did}#key-1`, type: "EcdsaSecp256k1VerificationKey2019", controller: did }],
              authentication: [`${did}#key-1`],
            },
            registered: !!agentData,
            agentData,
          }, "Agent DID Document");
        }

        return formatReadResult({ error: "Unknown action" }, "Error");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
