import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  const hash = params.hash;

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

  // Try Pinata gateway as fallback
  try {
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    }
  } catch {
    // Gateway failed
  }

  return NextResponse.json({ error: "Content not found" }, { status: 404 });
}
