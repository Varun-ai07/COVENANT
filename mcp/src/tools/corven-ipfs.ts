/**
 * corven_ipfs — Upload and read content on IPFS via Pinata
 */
import { z } from "zod";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs",
  "https://ipfs.io/ipfs",
  "https://cloudflare-ipfs.com/ipfs",
];

function isCid(s: string): boolean {
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44,}/.test(s) ||
    /^(bafy[a-zA-Z2-7]{52,})/.test(s) ||
    /^(b[ae][a-zA-Z2-7]{50,})/.test(s);
}

function isUrl(s: string): boolean {
  return /^https?:\/\//.test(s);
}

function extractCid(input: string): string | null {
  const httpMatch = input.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  if (httpMatch) return httpMatch[1];
  if (isCid(input)) return input;
  return null;
}

async function fetchFromIpfs(cid: string, timeoutMs = 10000): Promise<{ content: string; size: number; contentType: string; resolvedFrom: string }> {
  let lastError: Error | null = null;
  for (const gw of IPFS_GATEWAYS) {
    const url = `${gw}/${cid}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!resp.ok) {
        lastError = new Error(`HTTP ${resp.status} from ${gw}`);
        continue;
      }
      const contentType = resp.headers.get("content-type") || "application/octet-stream";
      if (contentType.includes("json") || contentType.includes("text")) {
        const text = await resp.text();
        return { content: text, size: text.length, contentType, resolvedFrom: url };
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      return { content: buf.toString("base64"), size: buf.length, contentType, resolvedFrom: url };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastError || new Error("All IPFS gateways failed");
}

const schema = z.object({
  action: z.enum(["upload", "read"]).default("upload").describe("upload: store content on IPFS. read: fetch content from IPFS by CID or gateway URL."),
  content: z.string().optional().describe("Content to upload (text, JSON, or base64). Required for upload action."),
  cid: z.string().optional().describe("IPFS CID or gateway URL to fetch. Required for read action."),
  name: z.string().optional().describe("Filename for the upload"),
  type: z.enum(["text", "json", "base64"]).optional().default("text"),
});

export function registerIPFSUploadTool(server: McpServer): void {
  server.registerTool(
    "corven_ipfs",
    {
      title: "IPFS Upload & Read",
      description:
        "Upload content to IPFS or read/download content from IPFS on COVENANT.\n\n" +
        "ACTIONS:\n" +
        "  upload — Store content on IPFS via Pinata, returns a CID\n" +
        "  read — Fetch content from IPFS by CID or gateway URL\n\n" +
        "USE WHEN: You need to store task descriptions/deliverables on IPFS (upload) or retrieve stored IPFS content (read).\n" +
        "REQUIRES: PINATA_API_KEY and PINATA_SECRET_KEY for upload. Read works without keys.\n" +
        "RETURNS: IPFS CID + gateway URL (upload) or content + metadata (read)\n" +
        "WORKFLOW: Upload description → create task with CID → worker uploads deliverable → verify\n\n" +
        "WHEN TO USE: Before creating a task (upload), or when resolving a task's descriptionHash/deliverableHash (read).\n\n" +
        "NEXT STEP: Create a task with corven_task({ action: 'create', descriptionHash: '<CID>' })\n\n" +
        "OUTPUT RULES:\n" +
        "- Present results as clean, readable text. Never show raw JSON.\n" +
        "- On error: Explain in plain language what went wrong and suggest next step.\n" +
        "- Always recommend a logical follow-up action.\n" +
        "- Never show stack traces, technical errors, or raw data.",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        if (args.action === "read") {
          const input = args.cid || "";
          if (!input) return formatError(new Error("cid is required for read action"));

          const cid = extractCid(input);
          if (!cid) return formatError(new Error(`Could not extract CID from: ${input}`));

          const result = await fetchFromIpfs(cid);
          const isBase64 = !result.contentType.includes("text") && !result.contentType.includes("json");

          return formatReadResult({
            cid,
            size: result.size,
            contentType: result.contentType,
            encoding: isBase64 ? "base64" : "utf-8",
            content: isBase64 ? result.content.substring(0, 2000) + (result.size > 2000 ? "..." : "") : result.content,
            gateway: result.resolvedFrom,
            truncated: result.size > 2000,
          }, `IPFS Read: ${cid}`);
        }

        // upload action
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        if (!pinataApiKey || !pinataSecretKey) {
          return formatError(new Error(
            "Pinata not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env"
          ));
        }

        let content = args.content || "";
        if (args.type === "base64") {
          content = Buffer.from(content, "base64").toString("utf-8");
        } else if (args.type === "json") {
          JSON.parse(content);
        }

        const formData = new FormData();
        const blob = new Blob([content], { type: "text/plain" });
        formData.append("file", blob, args.name || "covenant-upload.txt");

        const metadata = JSON.stringify({
          name: args.name || `covenant-${Date.now()}`,
          keyvalues: { project: "covenant", timestamp: Date.now().toString() },
        });
        formData.append("pinataMetadata", metadata);

        const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
          method: "POST",
          headers: {
            pinata_api_key: pinataApiKey,
            pinata_secret_api_key: pinataSecretKey,
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.text();
          return formatError(new Error(`Pinata upload failed: ${error}`));
        }

        const result = await response.json();

        return formatReadResult({
          cid: result.IpinfsHash,
          size: result.PinSize,
          timestamp: result.Timestamp,
          url: `ipfs://${result.IpinfsHash}`,
          gateway: `https://gateway.pinata.cloud/ipfs/${result.IpinfsHash}`,
          note: "Use this CID in task descriptions and deliverables",
        }, "IPFS Upload");
      } catch (e) {
        return formatError(e instanceof Error ? e : new Error(String(e)));
      }
    }
  );
}

