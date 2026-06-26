/**
 * corven_encrypt — Encrypt and decrypt task content using AES-256-GCM.
 */
import { z } from "zod";
import { randomBytes, createCipheriv, createDecipheriv, createHash } from "crypto";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function deriveKey(sharedSecret: string): Buffer {
  return createHash("sha256").update(sharedSecret).digest();
}

function encryptContent(plaintext: string, sharedSecret: string): { ciphertext: string; nonce: string; tag: string } {
  const key = deriveKey(sharedSecret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return {
    ciphertext: encrypted,
    nonce: iv.toString("hex"),
    tag,
  };
}

function decryptContent(ciphertext: string, sharedSecret: string, nonce: string, tag: string): string {
  const key = deriveKey(sharedSecret);
  const iv = Buffer.from(nonce, "hex");
  const authTag = Buffer.from(tag, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

const schema = z.object({
  action: z
    .enum(["encrypt", "decrypt"])
    .describe("encrypt: encrypt content with a shared secret. decrypt: decrypt content using key + nonce."),
  content: z.string().optional().describe("Plaintext content to encrypt (required for encrypt)"),
  recipientPublicKey: z.string().optional().describe("Shared secret or public key for encryption (required for encrypt)"),
  encryptedData: z.string().optional().describe("Encrypted ciphertext (required for decrypt)"),
  nonce: z.string().optional().describe("Hex-encoded nonce/IV (required for decrypt)"),
  key: z.string().optional().describe("Shared secret or decryption key (required for decrypt)"),
  tag: z.string().optional().describe("Hex-encoded auth tag (required for decrypt)"),
});

export function registerEncryptTools(server: McpServer): void {
  server.registerTool(
    "corven_encrypt",
    {
      title: "Encrypted Task Content",
      description:
        "Encrypt and decrypt task content using AES-256-GCM symmetric encryption.\n\n" +
        "ACTIONS:\n" +
        "  encrypt — Encrypt plaintext with a shared secret, returns ciphertext + nonce + tag\n" +
        "  decrypt — Decrypt ciphertext using key + nonce + tag, returns plaintext\n\n" +
        "USE WHEN: You need to protect sensitive task content (API keys, secrets, PII)\n" +
        "so only the intended recipient can read it on-chain or in IPFS.\n\n" +
        "WORKFLOW: encrypt content → share ciphertext + nonce + tag + key securely → recipient decrypts\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const { action } = args;

        if (action === "encrypt") {
          if (!args.content) return formatError(new Error("content is required for encrypt action"));
          if (!args.recipientPublicKey) return formatError(new Error("recipientPublicKey (shared secret) is required for encrypt"));

          const { ciphertext, nonce, tag } = encryptContent(args.content, args.recipientPublicKey);

          return formatReadResult(
            {
              ciphertext,
              nonce,
              tag,
              algorithm: ALGORITHM,
              note: "Share ciphertext, nonce, tag, and the shared secret with the recipient separately.",
            },
            "Content Encrypted"
          );
        }

        if (action === "decrypt") {
          if (!args.encryptedData) return formatError(new Error("encryptedData is required for decrypt action"));
          if (!args.key) return formatError(new Error("key (shared secret) is required for decrypt"));
          if (!args.nonce) return formatError(new Error("nonce is required for decrypt"));
          if (!args.tag) return formatError(new Error("tag is required for decrypt"));

          try {
            const plaintext = decryptContent(args.encryptedData, args.key, args.nonce, args.tag);

            return formatReadResult(
              {
                content: plaintext,
                algorithm: ALGORITHM,
                decrypted: true,
              },
              "Content Decrypted"
            );
          } catch (decErr) {
            return formatError(
              new Error(
                `Decryption failed — wrong key, nonce, or tag. ` +
                `Ensure all three match the encryption parameters. (${decErr instanceof Error ? decErr.message : String(decErr)})`
              )
            );
          }
        }

        return formatError(new Error(`Unknown action: ${action}`));
      } catch (e) {
        return formatError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}
