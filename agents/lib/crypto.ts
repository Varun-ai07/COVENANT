import { x25519 } from "@noble/curves/ed25519";
import { gcm } from "@noble/ciphers/aes";
import { randomBytes as nodeRandomBytes } from "crypto";

// Use Node.js crypto for random bytes
function randomBytes(length: number): Uint8Array {
  return new Uint8Array(nodeRandomBytes(length));
}

/**
 * Generate a new ECDH key pair for encryption
 */
export function generateKeyPair() {
  const privateKey = randomBytes(32);
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Derive shared secret using ECDH
 */
export function deriveSharedSecret(
  myPrivateKey: Uint8Array,
  theirPublicKey: Uint8Array
): Uint8Array {
  return x25519.getSharedSecret(myPrivateKey, theirPublicKey);
}

/**
 * Encrypt data using AES-GCM with ECDH shared secret
 */
export function encrypt(
  plaintext: string,
  sharedSecret: Uint8Array
): { ciphertext: Uint8Array; iv: Uint8Array } {
  const iv = randomBytes(12); // 96-bit IV for GCM
  const aes = gcm(sharedSecret, iv);
  const ciphertext = aes.encrypt(new TextEncoder().encode(plaintext));
  return { ciphertext, iv };
}

/**
 * Decrypt data using AES-GCM with ECDH shared secret
 */
export function decrypt(
  ciphertext: Uint8Array,
  sharedSecret: Uint8Array,
  iv: Uint8Array
): string {
  const aes = gcm(sharedSecret, iv);
  const plaintext = aes.decrypt(ciphertext);
  return new TextDecoder().decode(plaintext);
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
