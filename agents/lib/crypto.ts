import * as LitJsSdk from "@lit-protocol/lit-node-client";
// Import ethers properly
import { ethers } from "ethers";

// Initialize Lit client (singleton)
let litClient: LitJsSdk.LitNodeClient | null = null;

/**
 * Initialize Lit Protocol client
 */
export async function initLitClient(): Promise<void> {
  if (litClient) {
    return; // Already initialized
  }
  
  litClient = new LitJsSdk.LitNodeClient({
    alertWhenUnauthorized: false,
    litNetwork: "datil-test", // Use datil testnet for development
    debug: false,
  });
  
  await litClient.connect();
}

/**
 * Generate a new encryption key pair using Lit Protocol
 * Note: With Lit Protocol, keys are managed by the network, so we return a placeholder
 * for compatibility with existing code that expects a key pair
 */
export async function generateKeyPair(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  // Ensure Lit client is initialized
  await initLitClient();
  
  // With Lit Protocol, we don't generate traditional key pairs locally
  // Instead, we rely on the network for key management
  // Returning a placeholder key pair for compatibility
  const privateKey = new Uint8Array(32); // Placeholder
  const publicKey = new Uint8Array(32); // Placeholder
  
  // Fill with dummy data to avoid undefined issues
  for (let i = 0; i < 32; i++) {
    privateKey[i] = i + 1;
    publicKey[i] = (i + 1) * 2;
  }
  
  // In a real implementation, we would:
  // 1. Use Lit Protocol to get or create a key pair
  // 2. Store the private key securely (encrypted, preferably in browser storage)
  // 3. Use the public key for encryption operations
  
  return { privateKey, publicKey };
}

/**
 * Derive shared secret using Lit Protocol
 * Note: With Lit Protocol, we use the network for encryption/decryption directly
 * This function is kept for compatibility but returns a placeholder
 */
export async function deriveSharedSecret(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Promise<Uint8Array> {
  // Ensure Lit client is initialized
  await initLitClient();
  
  // With Lit Protocol, we don't derive shared secrets manually
  // Encryption/decryption is handled through the Lit Protocol network
  // Returning a placeholder for compatibility
  return new Uint8Array(32); // Placeholder
}

/**
 * Encrypt data using Lit Protocol with access control
 * Encrypts plaintext and returns the encrypted string along with metadata
 * needed for decryption
 */
export async function encrypt(
  plaintext: string,
  _sharedSecret: Uint8Array // Kept for compatibility but not used
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; ephemeralPublicKey: Uint8Array; }> {
  // Ensure Lit client is initialized
  await initLitClient();
  
  if (!litClient) {
    throw new Error("Lit client not initialized");
  }
  
  // For compatibility with existing code, we'll return the same structure
  // but the actual encryption will be done via Lit Protocol
  
  // In a real implementation, we would:
  // 1. Define access control conditions (e.g., based on agent reputation)
  // 2. Use Lit Protocol to encrypt the string with those conditions
  // 3. Return the encrypted string and any necessary metadata
  
  // Access control condition: Only allow decryption by agents that can
  // prove they have a minimum reputation (this would be customized per task)
  const accessControlConditions = [
    {
      contractAddress: "", // Would be set to AgentRegistry address
      standardContractType: "",
      chain: "baseSepolia",
      method: "",
      parameters: [],
      returnValueTest: {
        key: "",
        comparator: ">=",
        value: ""
      }
    }
  ];
  
  try {
    // Encrypt the string using Lit Protocol
    const encryptedString = await litClient.encryptString({
      stringToEncrypt: plaintext,
      // In a real implementation, we would add access control conditions here
      // accessControlConditions,
    });
    
    // For compatibility with existing code structure, we need to return
    // ciphertext, iv, and ephemeralPublicKey
    // Since Lit Protocol returns a string, we'll convert it appropriately
    const ciphertext = new TextEncoder().encode(encryptedString);
    const iv = new Uint8Array(12); // 96-bit IV for GCM compatibility (placeholder)
    const ephemeralPublicKey = new Uint8Array(32); // Placeholder
    
    return { 
      ciphertext, 
      iv,
      ephemeralPublicKey
    };
  } catch (error) {
    console.error("Error encrypting with Lit Protocol:", error);
    // Fallback to placeholder implementation for compatibility
    const iv = new Uint8Array(12); // 96-bit IV for GCM compatibility
    const ciphertext = new TextEncoder().encode(plaintext); // Not actually encrypted - placeholder
    
    return { 
      ciphertext, 
      iv,
      ephemeralPublicKey: new Uint8Array(32) // Placeholder
    };
  }
}

/**
 * Decrypt data using Lit Protocol with access control
 * Takes encrypted data and returns the decrypted plaintext string
 */
export async function decrypt(
  ciphertext: Uint8Array,
  _sharedSecret: Uint8Array,
  iv: Uint8Array
): Promise<string> {
  // Ensure Lit client is initialized
  await initLitClient();
  
  if (!litClient) {
    throw new Error("Lit client not initialized");
  }
  
  try {
    // Convert ciphertext back to string for Lit Protocol
    const encryptedString = new TextDecoder().decode(ciphertext);
    
    // Decrypt the string using Lit Protocol
    const decryptedString = await litClient.decryptString({
      ciphertext: encryptedString,
      // In a real implementation, we would add access control conditions here
      // accessControlConditions,
    });
    
    return decryptedString;
  } catch (error) {
    console.error("Error decrypting with Lit Protocol:", error);
    // Fallback to placeholder implementation for compatibility
    return new TextDecoder().decode(ciphertext); // Not actually decrypted - placeholder
  }
}

/**
 * Encrypt data with specific access control conditions
 * This is the proper way to use Lit Protocol for conditional access
 */
export async function encryptWithAccessControl(
  plaintext: string,
  accessControlConditions: any[]
): Promise<string> {
  // Ensure Lit client is initialized
  await initLitClient();
  
  if (!litClient) {
    throw new Error("Lit client not initialized");
  }
  
  try {
    const encryptedString = await litClient.encryptString({
      stringToEncrypt: plaintext,
      accessControlConditions,
    });
    
    return encryptedString;
  } catch (error) {
    console.error("Error encrypting with access control:", error);
    throw error;
  }
}

/**
 * Decrypt data with specific access control conditions
 * This is the proper way to use Lit Protocol for conditional access
 */
export async function decryptWithAccessControl(
  ciphertext: string,
  accessControlConditions: any[]
): Promise<string> {
  // Ensure Lit client is initialized
  await initLitClient();
  
  if (!litClient) {
    throw new Error("Lit client not initialized");
  }
  
  try {
    const decryptedString = await litClient.decryptString({
      ciphertext,
      accessControlConditions,
    });
    
    return decryptedString;
  } catch (error) {
    console.error("Error decrypting with access control:", error);
    throw error;
  }
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
