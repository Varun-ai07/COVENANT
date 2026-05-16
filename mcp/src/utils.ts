/**
 * COVENANT MCP Utilities
 * Helper functions for encoding and data conversion
 */
import { pad, toHex, type Hex } from "viem";

/**
 * Convert a string to bytes32 format.
 * Handles IPFS CIDs and other task description hashes.
 *
 * For strings <= 31 chars: Encodes as UTF-8 bytes, padded right
 * For strings > 31 chars: Truncates to fit
 * For hex strings starting with 0x: Validates length and pads if needed
 */
export function stringToBytes32(str: string): Hex {
  // If it's already a 0x-prefixed hex string
  if (str.startsWith("0x")) {
    // If it's exactly 66 chars (0x + 64 hex digits), it's already bytes32
    if (str.length === 66) {
      return str as Hex;
    }
    // If shorter, pad to 32 bytes (left-pad for numbers)
    if (str.length < 66) {
      return pad(str as Hex, { size: 32 });
    }
    // If longer, truncate
    return str.slice(0, 66) as Hex;
  }

  // For plaintext strings, encode to hex and pad
  // Convert string to UTF-8 bytes, then to hex
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);

  // bytes32 is 32 bytes, strings can use up to 31 bytes (last byte is length)
  // For simplicity, we truncate to 31 bytes and pad
  const truncatedBytes = bytes.slice(0, 31);
  const hexString = toHex(truncatedBytes);

  // Pad to 32 bytes (right-pad for string data)
  return pad(hexString as Hex, { size: 32, dir: "right" });
}

/**
 * Convert an array of strings to bytes32 format.
 */
export function stringsToBytes32(strings: string[]): Hex[] {
  return strings.map(stringToBytes32);
}

/**
 * Decode bytes32 back to string (for display purposes).
 * Falls back to hex string if not UTF-8 decodable.
 */
export function bytes32ToString(bytes32: Hex): string {
  try {
    // Remove 0x prefix and decode hex as UTF-8
    const hex = bytes32.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    // Find null terminator or trailing zeros
    let end = bytes.findIndex(b => b === 0);
    if (end === -1) end = bytes.length;
    const decoder = new TextDecoder();
    return decoder.decode(bytes.slice(0, end));
  } catch {
    // If decoding fails, return hex representation
    return bytes32;
  }
}

/**
 * Convert a numeric ID to bytes32 format.
 * Left-pads the number to 32 bytes.
 */
export function numberToBytes32(num: number | bigint): Hex {
  // Convert to hex and left-pad to 32 bytes
  const hex = typeof num === 'bigint'
    ? `0x${num.toString(16)}`
    : `0x${num.toString(16)}`;
  return pad(hex as Hex, { size: 32 });
}

/**
 * Validate that a string is a valid bytes32.
 */
export function isBytes32(str: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(str);
}

// ============================================================
// IPFS Gateway Configuration with Fallbacks
// ============================================================

// Gateway priority list (dedicated Pinata first, then public gateways)
const IPFS_GATEWAYS = [
  // Dedicated Pinata gateway (requires PINATA_GATEWAY in env)
  process.env.PINATA_GATEWAY,
  // Public Pinata gateway
  "https://gateway.pinata.cloud",
  // IPFS.io public gateway
  "https://ipfs.io",
  // Cloudflare IPFS gateway
  "https://cloudflare-ipfs.com",
  // dWeb gateway
  "https://dweb.link",
].filter(Boolean) as string[];

// Cache for gateway health status
const gatewayHealth = new Map<string, { latency: number; lastCheck: number; failures: number }>();

/**
 * Get the best available IPFS gateway
 */
export function getBestGateway(): string {
  // Check for dedicated gateway first
  if (process.env.PINATA_GATEWAY) {
    return process.env.PINATA_GATEWAY;
  }

  // Fall back to first available gateway
  return IPFS_GATEWAYS[0] || "https://ipfs.io";
}

/**
 * Build an IPFS URL for a CID
 */
export function buildIpfsUrl(cid: string, gateway?: string): string {
  const gw = gateway || getBestGateway();

  // Handle different CID formats
  if (cid.startsWith("Qm") || cid.startsWith("baf")) {
    return `${gw}/ipfs/${cid}`;
  }

  // Already a URL
  if (cid.startsWith("http")) {
    return cid;
  }

  return `${gw}/ipfs/${cid}`;
}

/**
 * Fetch from IPFS with gateway fallback
 */
export async function fetchFromIpfs(cid: string, timeoutMs = 30000): Promise<Response> {
  const errors: Error[] = [];

  // Sort gateways by health
  const sortedGateways = [...IPFS_GATEWAYS].sort((a, b) => {
    const healthA = gatewayHealth.get(a);
    const healthB = gatewayHealth.get(b);

    if (!healthA && !healthB) return 0;
    if (!healthA) return 1;
    if (!healthB) return -1;

    // Prefer lower latency and fewer failures
    const scoreA = healthA.latency + (healthA.failures * 1000);
    const scoreB = healthB.latency + (healthB.failures * 1000);
    return scoreA - scoreB;
  });

  // Try each gateway in order
  for (const gateway of sortedGateways) {
    try {
      const url = buildIpfsUrl(cid, gateway);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const start = Date.now();
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "Accept": "application/json, text/plain, */*",
          "User-Agent": "COVENANT-MCP/1.0",
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        // Update health metrics
        gatewayHealth.set(gateway, {
          latency: Date.now() - start,
          lastCheck: Date.now(),
          failures: gatewayHealth.get(gateway)?.failures || 0,
        });
        return response;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      // Mark gateway as failed
      const current = gatewayHealth.get(gateway) || { latency: 0, lastCheck: 0, failures: 0 };
      gatewayHealth.set(gateway, {
        ...current,
        failures: current.failures + 1,
        lastCheck: Date.now(),
      });
    }
  }

  throw new Error(`Failed to fetch ${cid} from all gateways: ${errors.map(e => e.message).join(", ")}`);
}

/**
 * Check gateway health
 */
export async function checkGatewayHealth(): Promise<Record<string, { healthy: boolean; latency: number }>> {
  const results: Record<string, { healthy: boolean; latency: number }> = {};

  await Promise.all(
    IPFS_GATEWAYS.map(async (gateway) => {
      try {
        const start = Date.now();
        const response = await fetch(`${gateway}/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn`, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });
        const latency = Date.now() - start;

        results[gateway] = {
          healthy: response.ok,
          latency,
        };

        gatewayHealth.set(gateway, {
          latency,
          lastCheck: Date.now(),
          failures: response.ok ? 0 : (gatewayHealth.get(gateway)?.failures || 0) + 1,
        });
      } catch {
        results[gateway] = { healthy: false, latency: -1 };
      }
    })
  );

  return results;
}
