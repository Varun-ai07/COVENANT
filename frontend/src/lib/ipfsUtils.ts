/**
 * IPFS Utility Functions
 * Simple helper for IPFS hash handling
 */

/**
 * Decode IPFS hash to get the full IPFS URL
 * @param hash - IPFS hash (with or without ipfs:// prefix)
 * @returns Full IPFS gateway URL
 */
export function decodeIPFSHash(hash: string): string {
  if (!hash) return "";

  // Remove ipfs:// prefix if present
  const cleanHash = hash.replace(/^ipfs:\/\//, "");

  // Return gateway URL
  return `https://ipfs.io/ipfs/${cleanHash}`;
}

/**
 * Convert content to IPFS hash (placeholder - would need actual IPFS upload)
 * In production, upload to Pinata or similar service
 * @param content - Content to upload (string or object)
 * @returns Mock hash for now
 */
export function contentToIPFSHash(content: any): string {
  // In real implementation: upload to IPFS and return CID
  // For now, return a mock hash
  if (typeof content === "string") {
    return `ipfs://Qm${btoa(content).slice(0, 44)}`;
  }
  return `ipfs://Qm${btoa(JSON.stringify(content)).slice(0, 44)}`;
}
