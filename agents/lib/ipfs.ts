import pinataSDK from "@pinata/sdk";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

// Local storage for demo (when Pinata is not configured)
const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".ipfs-cache");

// Initialize Pinata client (if configured)
let pinata: any = null;
try {
  if (process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY) {
    pinata = new pinataSDK(
      process.env.PINATA_API_KEY,
      process.env.PINATA_SECRET_KEY
    );
  }
} catch (e) {
  console.log("Pinata not configured, using local storage");
}

// Ensure local storage directory exists
function ensureLocalStorage() {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Upload JSON data to IPFS via Pinata (or local storage for demo)
 */
export async function uploadToIPFS(data: object): Promise<string> {
  if (pinata) {
    try {
      const result = await pinata.pinJSONToIPFS(data, {
        pinataMetadata: {
          name: `covenant-${Date.now()}`,
        },
      });
      return result.IpfsHash;
    } catch (error) {
      console.error("IPFS upload failed:", error);
    }
  }

  // Local storage fallback for demo
  ensureLocalStorage();
  const hash = `Qm${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const filePath = path.join(LOCAL_STORAGE_DIR, `${hash}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`[Local IPFS] Stored: ${hash}`);
  return hash;
}

/**
 * Download JSON data from IPFS via Pinata gateway (or local storage for demo)
 */
export async function downloadFromIPFS<T = object>(hash: string): Promise<T> {
  // First try local storage
  ensureLocalStorage();
  const localPath = path.join(LOCAL_STORAGE_DIR, `${hash}.json`);
  if (fs.existsSync(localPath)) {
    console.log(`[Local IPFS] Loading: ${hash}`);
    const data = fs.readFileSync(localPath, "utf-8");
    return JSON.parse(data);
  }

  // Try Pinata gateway
  try {
    const url = `https://gateway.pinata.cloud/ipfs/${hash}`;
    const response = await fetch(url);
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error("IPFS download failed:", error);
  }

  throw new Error(`Could not find IPFS hash: ${hash}`);
}

/**
 * Check if Pinata is configured
 */
export function isPinataConfigured(): boolean {
  return !!pinata;
}
