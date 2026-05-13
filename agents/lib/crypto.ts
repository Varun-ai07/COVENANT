/**
 * COVENANT Lit Protocol Integration
 *
 * Provides threshold encryption with access control conditions for:
 * - Reputation-based decryption (agents with min reputation can decrypt)
 * - Participant-based decryption (only client or worker can decrypt)
 */

import { LitNodeClient } from "@lit-protocol/lit-node-client";
import {
  encryptString,
  decryptToString,
  encryptToJson,
  decryptFromJson,
} from "@lit-protocol/encryption";
import {
  createSiweMessageWithResources,
  generateAuthSig,
  LitAccessControlConditionResource,
} from "@lit-protocol/auth-helpers";
import { LIT_ABILITY } from "@lit-protocol/constants";
import type { SessionSigsMap, AccessControlConditions } from "@lit-protocol/types";
import { ethers } from "ethers";
import type { Address } from "viem";

// ============================================================================
// Configuration
// ============================================================================

const LIT_NETWORK = "datil-test" as const;
const CHAIN = "baseSepolia" as const;

// Singleton Lit client
let litClient: LitNodeClient | null = null;

// ============================================================================
// Client Initialization
// ============================================================================

/**
 * Get or initialize the Lit Protocol client
 */
export async function getLitClient(): Promise<LitNodeClient> {
  if (litClient) {
    return litClient;
  }

  litClient = new LitNodeClient({
    alertWhenUnauthorized: false,
    litNetwork: LIT_NETWORK,
    debug: false,
  });

  await litClient.connect();
  console.log("✓ Lit Protocol client connected to", LIT_NETWORK);
  return litClient;
}

/**
 * Disconnect the Lit client (cleanup)
 */
export async function disconnectLitClient(): Promise<void> {
  if (litClient) {
    await litClient.disconnect();
    litClient = null;
  }
}

// ============================================================================
// Session Signatures
// ============================================================================

/**
 * Get session signatures for a wallet
 * Required for all encrypt/decrypt operations in Lit Protocol v7
 */
export async function getSessionSigs(
  wallet: ethers.Wallet
): Promise<SessionSigsMap> {
  const client = await getLitClient();

  const sessionSigs = await client.getSessionSigs({
    chain: CHAIN,
    resourceAbilityRequests: [
      {
        resource: new LitAccessControlConditionResource("*"),
        ability: LIT_ABILITY.AccessControlConditionDecryption,
      },
    ],
    authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
      const toSign = await createSiweMessageWithResources({
        uri: uri!,
        expiration: expiration!,
        resources: resourceAbilityRequests!,
        walletAddress: wallet.address,
        nonce: await client.getLatestBlockhash(),
        litNodeClient: client,
      });

      return generateAuthSig({ signer: wallet, toSign });
    },
  });

  return sessionSigs;
}

// ============================================================================
// Access Control Conditions
// ============================================================================

/**
 * Create access control conditions for reputation-based decryption
 * Only agents with reputation >= minReputation can decrypt
 */
export function createReputationAccessControl(
  registryAddress: Address,
  minReputation: number
): AccessControlConditions {
  return [
    {
      contractAddress: registryAddress,
      standardContractType: "Custom",
      chain: CHAIN,
      method: "getReputation",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: ">=",
        value: minReputation.toString(),
      },
    },
  ];
}

/**
 * Create access control conditions for participant-based decryption
 * Only the client or worker can decrypt
 */
export function createParticipantAccessControl(
  clientAddress: Address,
  workerAddress: Address
): AccessControlConditions {
  return [
    {
      contractAddress: "",
      standardContractType: "",
      chain: CHAIN,
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: clientAddress,
      },
    },
    { operator: "or" },
    {
      contractAddress: "",
      standardContractType: "",
      chain: CHAIN,
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: workerAddress,
      },
    },
  ];
}

/**
 * Create access control conditions for NFT ownership
 * Only holders of a specific NFT can decrypt
 */
export function createNFTAccessControl(
  nftContractAddress: Address,
  tokenId?: string
): AccessControlConditions {
  const condition: any = {
    contractAddress: nftContractAddress,
    standardContractType: "ERC721",
    chain: CHAIN,
    method: "ownerOf",
    parameters: tokenId ? [tokenId] : ["1"],
    returnValueTest: {
      comparator: "=",
      value: ":userAddress",
    },
  };

  return [condition];
}

/**
 * Create access control conditions for ERC20 token balance
 * Only addresses with balance >= minBalance can decrypt
 */
export function createTokenBalanceAccessControl(
  tokenAddress: Address,
  minBalance: string
): AccessControlConditions {
  return [
    {
      contractAddress: tokenAddress,
      standardContractType: "ERC20",
      chain: CHAIN,
      method: "balanceOf",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: ">=",
        value: minBalance,
      },
    },
  ];
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypt a string with access control conditions
 * Returns JSON payload containing ciphertext + metadata
 */
export async function encryptWithAccessControl(
  plaintext: string,
  accessControlConditions: AccessControlConditions
): Promise<string> {
  const client = await getLitClient();

  const jsonPayload = await encryptToJson({
    accessControlConditions,
    chain: CHAIN,
    string: plaintext,
    litNodeClient: client,
  });

  return jsonPayload;
}

/**
 * Decrypt a JSON payload with session signatures
 * The wallet must satisfy the access control conditions
 */
export async function decryptWithAccessControl(
  jsonPayload: string,
  sessionSigs: SessionSigsMap
): Promise<string> {
  const client = await getLitClient();

  const parsedJsonData = JSON.parse(jsonPayload);
  const plaintext = await decryptFromJson({
    parsedJsonData,
    sessionSigs,
    litNodeClient: client,
  });

  return plaintext;
}

/**
 * Encrypt string (raw API - returns ciphertext + hash)
 */
export async function encryptStringRaw(
  plaintext: string,
  accessControlConditions: AccessControlConditions
): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
  const client = await getLitClient();

  const result = await encryptString(
    {
      accessControlConditions,
      dataToEncrypt: plaintext,
    },
    client
  );

  return {
    ciphertext: result.ciphertext,
    dataToEncryptHash: result.dataToEncryptHash,
  };
}

/**
 * Decrypt string (raw API - requires ciphertext + hash)
 */
export async function decryptStringRaw(
  ciphertext: string,
  dataToEncryptHash: string,
  accessControlConditions: AccessControlConditions,
  sessionSigs: SessionSigsMap
): Promise<string> {
  const client = await getLitClient();

  const plaintext = await decryptToString(
    {
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      chain: CHAIN,
      sessionSigs,
    },
    client
  );

  return plaintext;
}

// ============================================================================
// Convenience Functions for COVENANT
// ============================================================================

/**
 * Encrypt task description for open market
 * Only workers with minimum reputation can decrypt
 */
export async function encryptTaskDescription(
  description: string,
  registryAddress: Address,
  minReputation: number
): Promise<string> {
  const acc = createReputationAccessControl(registryAddress, minReputation);
  return encryptWithAccessControl(description, acc);
}

/**
 * Encrypt task deliverable
 * Only the client or worker can decrypt
 */
export async function encryptTaskDeliverable(
  deliverable: string,
  clientAddress: Address,
  workerAddress: Address
): Promise<string> {
  const acc = createParticipantAccessControl(clientAddress, workerAddress);
  return encryptWithAccessControl(deliverable, acc);
}

/**
 * Decrypt task data with the provided wallet
 */
export async function decryptTaskData(
  encryptedPayload: string,
  wallet: ethers.Wallet
): Promise<string> {
  const sessionSigs = await getSessionSigs(wallet);
  return decryptWithAccessControl(encryptedPayload, sessionSigs);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create an ethers wallet from a private key
 */
export function createWallet(privateKey: string): ethers.Wallet {
  return new ethers.Wallet(privateKey);
}

/**
 * Check if a wallet can satisfy access control conditions
 * (Does a pre-check without actually decrypting)
 */
export async function checkAccessConditions(
  walletAddress: Address,
  accessControlConditions: AccessControlConditions
): Promise<boolean> {
  // TODO: Implement using Lit's checkConditions API when available
  // For now, we just return true and let decrypt fail if conditions aren't met
  return true;
}

/**
 * Encode bytes to hex string
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Decode hex string to bytes
 */
export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
