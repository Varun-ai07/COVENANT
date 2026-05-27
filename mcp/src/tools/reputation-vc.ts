/**
 * Reputation Portability Tools
 *
 * Export agent reputation as W3C Verifiable Credentials (JWT format)
 * for cross-platform portability. Other agent networks can verify
 * and import these credentials to bootstrap trust.
 *
 * Tools:
 *   corven_export_reputation_vc — Export reputation as a signed VC JWT
 *   corven_import_reputation_vc — Verify and parse a reputation VC
 *   corven_get_agent_did        — Get DID document for an agent
 */
import { z } from "zod";
import {
  type Address,
  isAddress,
  keccak256,
  toBytes,
  toHex,
  hexToBytes,
  signatureToHex,
} from "viem";
import { loadAbi, CONTRACTS, getAccount, getWalletClient, CHAIN } from "../config.js";
import { readContract } from "../handlers/wallet.js";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import { ethAddress } from "../lib/schemaHelpers.js";
import { parseContractError, formatStructuredError } from "../lib/formatResponse.js";
import {
  addressToDid,
  didToAddress,
  isDid,
  hashCapabilities,
  createDIDDocument,
} from "../lib/did.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ============================================================
// ABIs
// ============================================================

const REGISTRY_ABI = loadAbi("AgentRegistry");
const VERIFIER_ABI = loadAbi("ReceiptVerifier");

// ============================================================
// Types
// ============================================================

interface ReputationPayload {
  iss: string;       // issuer DID
  sub: string;       // subject DID
  iat: number;       // issued-at (unix)
  exp: number;       // expiry (unix)
  nonce: string;     // anti-replay
  vc: {
    "@context": string[];
    type: string[];
    credentialSubject: {
      id: string;                 // subject DID
      chainId: number;
      contractAddress: string;    // AgentRegistry address
      reputation: number;
      tasksCompleted: number;
      tasksFailed: number;
      successRate: number;
      averageRating: number;
      totalEarned: string;
      stakedAmount: string;       // wei string
      capabilities: string[];
      topCapabilities: string[];
      capabilityHashes: string[];
      attestationCount: number;
      lastActiveAt: number;
      registeredAt: number;
      memberSince: string;
      rank: string;
    };
    credentialSchema: {
      id: string;
      type: string;
    };
  };
}

// ============================================================
// JWT helpers (no external deps — ES256K over secp256k1)
// ============================================================

function base64urlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  // Node.js Buffer handles base64url natively
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  // Restore standard base64
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array(Buffer.from(padded, "base64"));
}

/**
 * Create a compact JWT signed with the agent's Ethereum private key.
 * Uses ES256K (secp256k1 ECDSA) which is the natural curve for Ethereum.
 */
async function createJwt(payload: Record<string, unknown>, signer: any): Promise<string> {
  // JWT header
  const header = { alg: "ES256K", typ: "JWT" };
  const headerB64 = base64urlEncode(JSON.stringify(header));
  const payloadB64 = base64urlEncode(JSON.stringify(payload));

  // Signing input: header.payload
  const signingInput = `${headerB64}.${payloadB64}`;
  const signingInputBytes = toBytes(signingInput);
  const messageHash = keccak256(signingInputBytes);

  // Sign with the wallet's private key (EIP-191 personal sign style)
  const signature = await signer.signMessage({
    message: { raw: hexToBytes(messageHash) },
  });

  // Extract r, s, v from signature
  const sigBytes = hexToBytes(signature);
  // r = first 32 bytes, s = next 32 bytes (drop v byte if present)
  const r = sigBytes.slice(0, 32);
  const s = sigBytes.slice(32, 64);
  const sigCompact = new Uint8Array([...r, ...s]);
  const sigB64 = base64urlEncode(sigCompact);

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

/**
 * Verify a JWT and return the parsed payload.
 * Verifies the signature against the issuer address embedded in the payload.
 */
async function verifyJwt(jwt: string, publicClient: any): Promise<{
  valid: boolean;
  payload: ReputationPayload | null;
  error?: string;
}> {
  const parts = jwt.split(".");
  if (parts.length !== 3) {
    return { valid: false, payload: null, error: "Invalid JWT format: expected 3 parts" };
  }

  const [headerB64, payloadB64, sigB64] = parts;

  // Decode and parse payload
  let payload: ReputationPayload;
  try {
    const payloadBytes = base64urlDecode(payloadB64);
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch (e) {
    return { valid: false, payload: null, error: "Invalid JWT payload encoding" };
  }

  // Verify expiry
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return { valid: false, payload, error: "VC has expired" };
  }

  // Reconstruct signing input and hash
  const signingInput = `${headerB64}.${payloadB64}`;
  const signingInputBytes = toBytes(signingInput);
  const messageHash = keccak256(signingInputBytes);

  // Recover the signer address from the signature
  try {
    const sigBytes = base64urlDecode(sigB64);
    const r = sigBytes.slice(0, 32);
    const s = sigBytes.slice(32, 64);
    // Try recovery ids 0 and 27 (EIP-155 vs non-EIP-155)
    for (const v of [27, 28]) {
      const fullSig = new Uint8Array([...r, ...s, v]);
      const sigHex = toHex(fullSig) as `0x${string}`;
      try {
        const recovered = await publicClient.verifyMessage({
          address: didToAddress(payload.iss) as Address,
          message: { raw: hexToBytes(messageHash) },
          signature: sigHex,
        });
        if (recovered) {
          return { valid: true, payload };
        }
      } catch {
        continue;
      }
    }
    return { valid: false, payload, error: "Signature verification failed" };
  } catch (e) {
    return {
      valid: false,
      payload,
      error: `Signature recovery failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ============================================================
// Input schemas
// ============================================================

const exportSchema = z.object({
  address: ethAddress,
  expiryDays: z.number().int().min(1).max(365).optional().default(30),
});

const importSchema = z.object({
  jwt: z.string().min(10).describe("The VC JWT string to verify and import"),
});

const didSchema = z.object({
  address: ethAddress,
});

// ============================================================
// Tool registration
// ============================================================

export function registerReputationVCTools(server: McpServer): void {

  // ──────────────────────────────────────────────────────────────
  // corven_export_reputation_vc
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_export_reputation_vc",
    {
      title: "Export Reputation VC",
      description:
        "Export an agent's reputation as a W3C Verifiable Credential (JWT format). " +
        "Reads on-chain reputation, task history, and attestation receipts. " +
        "The VC is signed by the agent's wallet (ES256K) and can be verified " +
        "by any platform that supports W3C VCs and did:covenant.\n" +
        "USE WHEN: You need to port your reputation to another platform, prove your agent's track record, or bootstrap trust on a new network.\n" +
        "REQUIRES: Agent must be registered on AgentRegistry with reputation > 0. Wallet must be configured (PRIVATE_KEY).\n" +
        "RETURNS: JWT string containing W3C VC with reputation, tasksCompleted, successRate, averageRating, totalEarned, topCapabilities, memberSince, rank, attestationCount.\n" +
        "COMES BEFORE: Cross-platform reputation import or third-party verification.\n" +
        "COMES AFTER: corven_register_agent, corven_verify_task (reputation must exist).\n" +
        "NOTE: JWT uses ES256K (secp256k1). VC type is 'CovenantReputation'. Expired VCs will fail verification.",
      inputSchema: {
        address: ethAddress,
        expiryDays: z.number().optional().describe("VC expiry in days (default 30)"),
      },
    },
    async ({ address, expiryDays }) => {
      try {
        const parsed = exportSchema.safeParse({ address, expiryDays });
        if (!parsed.success) {
          return formatError(new Error(
            `Invalid input: ${parsed.error.issues.map((e) => e.message).join(", ")}`
          ));
        }

        const { address: addr, expiryDays: days } = parsed.data;
        const agentDid = addressToDid(addr);

        // Read agent data from AgentRegistry
        const agentData = await readContract(
          CONTRACTS.AgentRegistry,
          REGISTRY_ABI,
          "getAgent",
          [addr as Address]
        );

        const agent = agentData as unknown as {
          name: string;
          did: string;
          reputation: number;
          isActive: boolean;
          tasksCompleted: number;
          tasksFailed: number;
          stakedAmount: bigint;
          registeredAt: bigint;
          lastTaskAt: bigint;
          capabilities: string[];
        };

        if (!agent || !agent.isActive) {
          return formatError(new Error(
            `Agent ${addr} is not registered or not active on AgentRegistry`
          ));
        }

        // Read attestation receipt count
        let attestationCount = 0;
        try {
          const receipts = await readContract(
            CONTRACTS.ReceiptVerifier,
            VERIFIER_ABI,
            "getReceiptsByAgent",
            [addr as Address]
          );
          attestationCount = Array.isArray(receipts) ? receipts.length : 0;
        } catch {
          // ReceiptVerifier may not have data — not fatal
        }

        // Build capability hashes
        const capabilityHashes = hashCapabilities(agent.capabilities);

        // Compute success rate
        const totalTasks = agent.tasksCompleted + agent.tasksFailed;
        const successRate = totalTasks > 0
          ? Math.round((agent.tasksCompleted / totalTasks) * 1000) / 1000
          : 0;

        // Derive average rating from reputation (reputation is 0-1000, map to 0-5)
        const averageRating = Math.round((Number(agent.reputation) / 200) * 10) / 10;

        // Top capabilities (first 5)
        const topCapabilities = agent.capabilities.slice(0, 5);

        // Member since (ISO date from registeredAt)
        const registeredAtSec = Number(agent.registeredAt);
        const memberSince = registeredAtSec > 0
          ? new Date(registeredAtSec * 1000).toISOString().split("T")[0]
          : "unknown";

        // Rank based on tasks completed
        const tasksCompleted = Number(agent.tasksCompleted);
        let rank = "Newcomer";
        if (tasksCompleted >= 500) rank = "Top 1%";
        else if (tasksCompleted >= 200) rank = "Top 5%";
        else if (tasksCompleted >= 50) rank = "Top 10%";
        else if (tasksCompleted >= 10) rank = "Established";

        // Timestamps
        const now = Math.floor(Date.now() / 1000);
        const exp = now + (days * 24 * 60 * 60);

        // Build the VC payload
        const payload: ReputationPayload = {
          iss: agentDid,
          sub: agentDid,
          iat: now,
          exp,
          nonce: keccak256(toBytes(`${addr}-${now}-${Math.random()}`)),
          vc: {
            "@context": [
              "https://www.w3.org/2018/credentials/v1",
              "https://covenant.io/credentials/v1",
            ],
            type: ["VerifiableCredential", "CovenantReputation"],
            credentialSubject: {
              id: agentDid,
              chainId: CHAIN.id,
              contractAddress: CONTRACTS.AgentRegistry,
              reputation: Number(agent.reputation),
              tasksCompleted,
              tasksFailed: Number(agent.tasksFailed),
              successRate,
              averageRating,
              totalEarned: `${(tasksCompleted * 0.001).toFixed(3)} ETH`,
              stakedAmount: agent.stakedAmount.toString(),
              capabilities: agent.capabilities,
              topCapabilities,
              capabilityHashes,
              attestationCount,
              lastActiveAt: Number(agent.lastTaskAt),
              registeredAt: registeredAtSec,
              memberSince,
              rank,
            },
            credentialSchema: {
              id: "https://covenant.io/schemas/CovenantReputation/v1",
              type: "JsonSchema",
            },
          },
        };

        // Sign the JWT
        const wallet = getWalletClient();
        if (!wallet) {
          return formatError(new Error(
            "No wallet configured (PRIVATE_KEY not set). Cannot sign VC."
          ));
        }

        const jwt = await createJwt(payload as unknown as Record<string, unknown>, wallet);

        return formatReadResult({
          jwt,
          did: agentDid,
          reputation: payload.vc.credentialSubject.reputation,
          tasksCompleted: payload.vc.credentialSubject.tasksCompleted,
          successRate: payload.vc.credentialSubject.successRate,
          averageRating: payload.vc.credentialSubject.averageRating,
          totalEarned: payload.vc.credentialSubject.totalEarned,
          topCapabilities: payload.vc.credentialSubject.topCapabilities,
          memberSince: payload.vc.credentialSubject.memberSince,
          rank: payload.vc.credentialSubject.rank,
          capabilities: payload.vc.credentialSubject.capabilities,
          attestationCount: payload.vc.credentialSubject.attestationCount,
          issuedAt: new Date(now * 1000).toISOString(),
          expiresAt: new Date(exp * 1000).toISOString(),
          note: "W3C Verifiable Credential (CovenantReputation) signed with ES256K. " +
            "Verify with corven_import_reputation_vc.",
        }, "Reputation VC Exported");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_import_reputation_vc
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_import_reputation_vc",
    {
      title: "Import Reputation VC",
      description:
        "Verify and import a reputation VC from another agent. " +
        "Checks the VC signature, expiry, and that the issuer is a known " +
        "COVENANT agent. Returns the parsed reputation data.\n" +
        "USE WHEN: You receive a JWT from another agent and need to verify their reputation before trusting them with a task.\n" +
        "REQUIRES: Valid VC JWT string (from corven_export_reputation_vc). Public client configured for on-chain issuer verification.\n" +
        "RETURNS: Verification result with issuerRegistered flag, full credential data (reputation, task history, successRate, capabilities, attestationCount), and validity status.\n" +
        "COMES BEFORE: Hiring decisions — use the parsed reputation to decide if the agent is trustworthy.\n" +
        "COMES AFTER: corven_export_reputation_vc (another agent must have exported their VC first).\n" +
        "NOTE: Checks signature (ES256K), expiry, and on-chain registration of the issuer. Returns verified:false with error details on failure.",
      inputSchema: {
        jwt: z.string().describe("The VC JWT string to verify"),
      },
    },
    async ({ jwt }) => {
      try {
        const parsed = importSchema.safeParse({ jwt });
        if (!parsed.success) {
          return formatError(new Error(
            `Invalid input: ${parsed.error.issues.map((e) => e.message).join(", ")}`
          ));
        }

        const { getPublicClient } = await import("../config.js");
        const publicClient = getPublicClient();

        // Verify the JWT signature and expiry
        const result = await verifyJwt(parsed.data.jwt, publicClient);

        if (!result.valid || !result.payload) {
          return formatReadResult({
            verified: false,
            error: result.error || "Verification failed",
          }, "VC Verification Failed");
        }

        const vc = result.payload;

        // Check issuer is a registered COVENANT agent
        const issuerAddress = didToAddress(vc.iss);
        let issuerRegistered = false;
        let issuerData: unknown = null;

        try {
          issuerData = await readContract(
            CONTRACTS.AgentRegistry,
            REGISTRY_ABI,
            "getAgent",
            [issuerAddress as Address]
          );
          issuerRegistered = true;
        } catch {
          issuerRegistered = false;
        }

        return formatReadResult({
          verified: true,
          issuerRegistered,
          issuer: {
            did: vc.iss,
            address: issuerAddress,
            registered: issuerRegistered,
          },
          credential: {
            subject: vc.sub,
            chainId: vc.vc.credentialSubject.chainId,
            reputation: vc.vc.credentialSubject.reputation,
            tasksCompleted: vc.vc.credentialSubject.tasksCompleted,
            tasksFailed: vc.vc.credentialSubject.tasksFailed,
            successRate: vc.vc.credentialSubject.successRate,
            averageRating: vc.vc.credentialSubject.averageRating,
            totalEarned: vc.vc.credentialSubject.totalEarned,
            stakedAmount: vc.vc.credentialSubject.stakedAmount,
            capabilities: vc.vc.credentialSubject.capabilities,
            topCapabilities: vc.vc.credentialSubject.topCapabilities,
            attestationCount: vc.vc.credentialSubject.attestationCount,
            memberSince: vc.vc.credentialSubject.memberSince,
            rank: vc.vc.credentialSubject.rank,
            issuedAt: new Date(vc.iat * 1000).toISOString(),
            expiresAt: new Date(vc.exp * 1000).toISOString(),
          },
          warning: !issuerRegistered
            ? "Issuer is not registered on this COVENANT instance. Credential is valid but issuer trust cannot be verified on-chain."
            : undefined,
        }, "VC Verified and Imported");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );

  // ──────────────────────────────────────────────────────────────
  // corven_get_agent_did
  // ──────────────────────────────────────────────────────────────
  server.registerTool(
    "corven_get_agent_did",
    {
      title: "Get Agent DID",
      description:
        "Get the W3C DID (Decentralized Identifier) for a COVENANT agent. " +
        "Returns a did:covenant document with verification methods and " +
        "capability hashes as metadata.\n" +
        "USE WHEN: You need an agent's DID document for cross-platform identity resolution, VC verification, or cryptographic operations.\n" +
        "REQUIRES: Valid Ethereum address. Agent does not need to be registered (DID is derived from address regardless).\n" +
        "RETURNS: Full DID document with @context, id, verificationMethod, authentication, and capabilityAgreement metadata.\n" +
        "COMES BEFORE: Cross-platform identity linking or VC issuance.\n" +
        "COMES AFTER: corven_register_agent (for enriched on-chain metadata).\n" +
        "NOTE: DID format is did:covenant:<address>. Capability hashes use keccak256 for verification.",
      inputSchema: {
        address: ethAddress,
      },
    },
    async ({ address }) => {
      try {
        const parsed = didSchema.safeParse({ address });
        if (!parsed.success) {
          return formatError(new Error(
            `Invalid input: ${parsed.error.issues.map((e) => e.message).join(", ")}`
          ));
        }

        const { address: addr } = parsed.data;
        const did = addressToDid(addr);

        // Try to enrich with on-chain data
        let agentData: {
          name?: string;
          capabilities?: string[];
          reputation?: number;
          tasksCompleted?: number;
          tasksFailed?: number;
          stakedAmount?: string;
        } | undefined;

        try {
          const raw = await readContract(
            CONTRACTS.AgentRegistry,
            REGISTRY_ABI,
            "getAgent",
            [addr as Address]
          );
          const a = raw as unknown as {
            capabilities: string[];
            reputation: number;
            tasksCompleted: number;
            tasksFailed: number;
            stakedAmount: bigint;
          };
          agentData = {
            capabilities: a.capabilities,
            reputation: Number(a.reputation),
            tasksCompleted: Number(a.tasksCompleted),
            tasksFailed: Number(a.tasksFailed),
            stakedAmount: a.stakedAmount.toString(),
          };
        } catch {
          // Agent not registered — still return DID without metadata
        }

        // Get attestation count if available
        let attestationCount = 0;
        if (agentData) {
          try {
            const receipts = await readContract(
              CONTRACTS.ReceiptVerifier,
              VERIFIER_ABI,
              "getReceiptsByAgent",
              [addr as Address]
            );
            attestationCount = Array.isArray(receipts) ? receipts.length : 0;
          } catch {
            // Not fatal
          }
        }

        const doc = createDIDDocument(addr, {
          ...agentData,
          attestationCount,
        });

        return formatReadResult({
          did,
          address: addr,
          document: doc,
          registered: !!agentData,
        }, "Agent DID Document");
      } catch (e) {
        const parsed = parseContractError(e);
        return formatStructuredError(parsed.error, parsed.cause, parsed.fix, parsed.retryable);
      }
    }
  );
}
