import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

function normalizeHash(input: string): string {
  const decoded = decodeURIComponent(input || "").trim();
  return decoded.replace(/^ipfs:\/\//, "").replace(/^\/ipfs\//, "").trim();
}

async function parseGatewayPayload(response: Response): Promise<unknown> {
  const bodyText = await response.text();
  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    return { raw: bodyText };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  const hash = normalizeHash(params.hash);

  if (!hash || hash === "0x" || hash === "0") {
    return NextResponse.json({ error: "Invalid IPFS hash" }, { status: 400 });
  }

  // Try to read from local IPFS cache (used by agents for demo)
  const localCachePath = join(process.cwd(), "..", "agents", ".ipfs-cache", `${hash}.json`);

  if (existsSync(localCachePath)) {
    try {
      const data = readFileSync(localCachePath, "utf-8");
      return NextResponse.json(JSON.parse(data));
    } catch {
      // Fall through to try gateway
    }
  }

  const gateways = [
    "https://gateway.pinata.cloud/ipfs",
    "https://ipfs.io/ipfs",
    "https://cloudflare-ipfs.com/ipfs",
  ];

  for (const gateway of gateways) {
    try {
      const response = await fetch(`${gateway}/${hash}`, {
        signal: AbortSignal.timeout(7000),
        headers: { Accept: "application/json,text/plain,*/*" },
      });

      if (response.ok) {
        const data = await parseGatewayPayload(response);
        return NextResponse.json(data);
      }
    } catch {
      // Try next gateway
    }
  }

  return NextResponse.json({ error: "Content not found" }, { status: 404 });
}
