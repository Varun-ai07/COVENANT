/**
 * Utility functions for COVENANT agents
 */

import { keccak256, toHex } from "viem";

/**
 * Convert an IPFS CID string to bytes32 for on-chain storage
 * For CIDv0: Qm + base58(sha256(hash)) → extract the 32-byte hash
 * We'll use the keccak256 of the CID string as fallback if not multihash
 *
 * Note: The proper conversion requires base58 decoding. For simplicity,
 * we store the keccak256 hash of the CID, which is deterministic and
 * can be used off-chain to reconstruct a valid CID by storing the full
 * string elsewhere (e.g., off-chain lookup). Another approach: store
 * the raw 32-byte multihash digest by base58 decoding the CID.
 *
 * For production, use a proper CID parser library.
 */
export function cidToBytes32(cid: string): bigint {
  // Quick check: if it's already a hex string of 32 bytes
  if (cid.startsWith("0x") && cid.length === 66) {
    return BigInt("0x" + cid.slice(2)); // parse as bigint
  }

  // Compute keccak256 hash of the CID string
  const hash = keccak256(toHex(cid));
  return BigInt(hash);
}

/**
 * Convert bytes32 back to a reversible IPFS CID (requires off-chain mapping)
 * Since we store a hash, we cannot recover exact original CID from just bytes32.
 * In a full implementation, store the full CID in an off-chain mapping alongside.
 */
export function bytes32ToCid(_hash: bigint): string {
  // Cannot reverse from hash to original CID without a lookup table.
  // This function is a placeholder.
  throw new Error("Cannot reverse bytes32 to CID without external mapping");
}

/**
 * Convert string IPFS hash to bytes32 using base58 decoding of multihash
 * This is the correct method but requires base58 decode.
 * Keep for future implementation with bs58 library.
 */
export function cidMultihashToBytes32(cid: string): bigint {
  // If CID is v0: Qm... it's base58 encoded: 0x12 0x20 + 32-byte SHA256
  // Steps:
  // 1. Base58 decode the CID to bytes
  // 2. Extract the multihash digest (the last 32 bytes typically)
  // 3. Encode as bigint

  // Placeholder - implement with bs58 library if needed
  throw new Error("Not implemented: use bs58 library for production");
}

/**
 * Encode a number as uint48 (used for deadlines and timestamps)
 */
export function toUint48(value: bigint | number): bigint {
  const max = (1n << 48n) - 1n;
  const bigValue = BigInt(value);
  if (bigValue < 0 || bigValue > max) {
    throw new Error(`Value ${bigValue} out of uint48 range`);
  }
  return bigValue;
}

/**
 * Check if a value fits in uint96
 */
export function isUint96(value: bigint | number): boolean {
  const bigValue = BigInt(value);
  const max = (1n << 96n) - 1n;
  return bigValue >= 0 && bigValue <= max;
}
