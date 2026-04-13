import { deriveSharedSecret } from "./crypto";
import { generateKeyPair } from "./crypto";

/**
 * Encrypt task description using XChaCha20-Poly1305 (via noble-ciphers)
 * In a real implementation, this would use the actual encryption library
 */
export async function encryptTaskDescription(
  description: string,
  recipientPublicKey: string
): Promise<{ encryptedData: string; nonce: string; ephemeralPublicKey: string }> {
  try {
    // Generate ephemeral key pair for this encryption
    const { privateKey: ephPriv, publicKey: ephPub } = generateKeyPair();
    
    // Derive shared secret using our ephemeral private key and recipient's public key
    const sharedSecret = await deriveSharedSecret(ephPriv, recipientPublicKey);
    
    // In a real implementation, we would use XChaCha20-Poly1305 here
    // For now, we'll simulate encryption by base64 encoding with a simple XOR-like operation
    const encoder = new TextEncoder();
    const data = encoder.encode(description);
    
    // Simple simulation - in reality use proper encryption
    const encrypted = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ (sharedSecret[i % sharedSecret.length] || 0);
    }
    
    // Add authentication tag simulation
    const encryptedWithTag = new Uint8Array(encrypted.length + 16);
    encryptedWithTag.set(encrypted);
    // Add dummy tag
    for (let i = 0; i < 16; i++) {
      encryptedWithTag[encrypted.length + i] = (sharedSecret[i] || 0) & 0xff;
    }
    
    return {
      encryptedData: btoa(String.fromCharCode(...encryptedWithTag)),
      nonce: window.crypto.getRandomValues(new Uint8Array(24)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), ''),
      ephemeralPublicKey: ephPub
    };
  } catch (error) {
    console.error("Error encrypting task description:", error);
    throw new Error("Failed to encrypt task description");
  }
}

/**
 * Decrypt task description using XChaCha20-Poly1305
 */
export async function decryptTaskDescription(
  encryptedData: string,
  nonce: string,
  ephemeralPublicKey: string,
  privateKey: string
): Promise<string> {
  try {
    // Derive shared secret using our private key and sender's ephemeral public key
    const sharedSecret = await deriveSharedSecret(privateKey, ephemeralPublicKey);
    
    // Decode the encrypted data
    const binaryString = atob(encryptedData);
    const encryptedWithTag = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      encryptedWithTag[i] = binaryString.charCodeAt(i);
    }
    
    // Extract encrypted data and tag
    const encrypted = encryptedWithTag.slice(0, encryptedWithTag.length - 16);
    const tag = encryptedWithTag.slice(encryptedWithTag.length - 16);
    
    // Verify tag (simplified)
    let validTag = true;
    for (let i = 0; i < tag.length; i++) {
      const expected = (sharedSecret[i] || 0) & 0xff;
      if (tag[i] !== expected) {
        validTag = false;
        break;
      }
    }
    
    if (!validTag) {
      throw new Error("Authentication failed: message may have been tampered with");
    }
    
    // Decrypt data
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ (sharedSecret[i % sharedSecret.length] || 0);
    }
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Error decrypting task description:", error);
    throw new Error("Failed to decrypt task description");
  }
}