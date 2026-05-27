/**
 * DID (Decentralized Identifier) Utilities
 *
 * W3C DID method for COVENANT agents.
 * Format: did:covenant:<address>
 *
 * Used by reputation VC tools to create portable agent identities.
 */
import { type Address, keccak256, toBytes, isAddress } from "viem";

// ============================================================
// DID Format
// ============================================================

const DID_PREFIX = "did:covenant:";

/**
 * Generate a COVENANT DID from an Ethereum address.
 * @example generateDID("0x70F6...") → "did:covenant:0x70F6..."
 */
export function generateDID(address: string): string {
  if (!isAddress(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return `${DID_PREFIX}${address.toLowerCase()}`;
}

/**
 * Parse a COVENANT DID and extract the Ethereum address.
 * @example parseDID("did:covenant:0x70F6...") → "0x70F6..."
 */
export function parseDID(did: string): string {
  if (!did.startsWith(DID_PREFIX)) {
    throw new Error(`Invalid DID format: expected did:covenant:0x..., got: ${did.slice(0, 20)}`);
  }

  const address = did.slice(DID_PREFIX.length);
  if (!isAddress(address)) {
    throw new Error(`Invalid address in DID: ${address}`);
  }

  return address;
}

/**
 * Validate a COVENANT DID string.
 */
export function isValidDID(value: string): boolean {
  if (!value.startsWith(DID_PREFIX)) return false;
  try {
    parseDID(value);
    return true;
  } catch {
    return false;
  }
}

// Backward-compatible aliases
export const addressToDid = generateDID;
export const didToAddress = parseDID;
export const isDid = isValidDID;

// ============================================================
// Capability Hashing
// ============================================================

/**
 * Hash a capability string to a deterministic bytes32.
 * Used to include capability proofs in DID documents without
 * exposing the raw strings on public credentials.
 */
export function hashCapability(capability: string): string {
  return keccak256(toBytes(capability));
}

/**
 * Hash an array of capabilities.
 */
export function hashCapabilities(capabilities: string[]): string[] {
  return capabilities.map(hashCapability);
}

// ============================================================
// DID Document
// ============================================================

interface AgentDIDDocument {
  "@context": string[];
  id: string;
  created: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    blockchainAccountId: string;
  }>;
  capabilityInvocation: string[];
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  metadata: {
    capabilities: string[];
    capabilityHashes: string[];
    reputation?: number;
    tasksCompleted?: number;
    tasksFailed?: number;
    stakedAmount?: string;
    attestationCount?: number;
  };
}

/**
 * Create a minimal DID document for a COVENANT agent.
 *
 * Includes:
 * - Verification method tied to the Ethereum address
 * - Capability hashes as metadata
 * - Optional reputation data (populated when agent is registered)
 */
export function createDIDDocument(
  address: string,
  agentData?: {
    name?: string;
    capabilities?: string[];
    reputation?: number;
    tasksCompleted?: number;
    tasksFailed?: number;
    stakedAmount?: string;
    attestationCount?: number;
  }
): AgentDIDDocument {
  const did = addressToDid(address);

  const capabilityHashes = agentData?.capabilities
    ? hashCapabilities(agentData.capabilities)
    : [];

  const doc: AgentDIDDocument = {
    "@context": [
      "https://www.w3.org/ns/did/v1",
      "https://covenant.io/did/v1",
      "https://w3id.org/security/suites/secp256k1recovery-2020/v2",
    ],
    id: did,
    created: new Date().toISOString(),
    verificationMethod: [
      {
        id: `${did}#controller`,
        type: "EcdsaSecp256k1RecoveryMethod2020",
        controller: did,
        blockchainAccountId: `eip155:84532:${address}`,
      },
    ],
    capabilityInvocation: [`${did}#controller`],
    metadata: {
      capabilities: agentData?.capabilities ?? [],
      capabilityHashes,
      reputation: agentData?.reputation,
      tasksCompleted: agentData?.tasksCompleted,
      tasksFailed: agentData?.tasksFailed,
      stakedAmount: agentData?.stakedAmount,
      attestationCount: agentData?.attestationCount,
    },
  };

  return doc;
}
