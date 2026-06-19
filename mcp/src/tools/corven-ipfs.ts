/**
 * corven_upload_ipfs — Upload content to IPFS
 */
import { z } from "zod";
import { formatReadResult, formatError } from "../handlers/transactions.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const schema = z.object({
  content: z.string().describe("Content to upload (text, JSON, or base64)"),
  name: z.string().optional().describe("Filename for the upload"),
  type: z.enum(["text", "json", "base64"]).optional().default("text"),
});

export function registerIPFSUploadTool(server: McpServer): void {
  server.registerTool(
    "corven_upload_ipfs",
    {
      title: "Upload to IPFS",
      description:
        "Upload content to IPFS via Pinata. Returns a CID you can use in tasks.\n\n" +
        "USE WHEN: You need to store task descriptions, deliverables, or any data on IPFS.\n" +
        "REQUIRES: PINATA_API_KEY and PINATA_SECRET_KEY in environment.\n" +
        "RETURNS: IPFS CID (e.g., QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o)\n" +
        "WORKFLOW: Upload description → create task with CID → worker uploads deliverable → verify",
      inputSchema: schema.shape,
    },
    async (args) => {
      try {
        const pinataApiKey = process.env.PINATA_API_KEY;
        const pinataSecretKey = process.env.PINATA_SECRET_KEY;

        if (!pinataApiKey || !pinataSecretKey) {
          return formatError(new Error(
            "Pinata not configured. Set PINATA_API_KEY and PINATA_SECRET_KEY in .env"
          ));
        }

        let content = args.content;
        if (args.type === "base64") {
          content = Buffer.from(args.content, "base64").toString("utf-8");
        } else if (args.type === "json") {
          JSON.parse(args.content);
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
