import { NextResponse } from "next/server";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

interface StoreIpfsRequest {
  payload: Record<string, unknown>;
}

function generatePseudoCid(): string {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
  return `Qm${seed.slice(0, 44).padEnd(44, "x")}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StoreIpfsRequest;

    if (!body || typeof body !== "object" || !body.payload || typeof body.payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const hash = generatePseudoCid();
    const cacheDir = join(process.cwd(), "..", "agents", ".ipfs-cache");

    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    const filePath = join(cacheDir, `${hash}.json`);
    writeFileSync(filePath, JSON.stringify(body.payload, null, 2), "utf-8");

    return NextResponse.json({ hash });
  } catch (error) {
    console.error("Failed to store IPFS payload:", error);
    return NextResponse.json({ error: "Failed to store IPFS payload" }, { status: 500 });
  }
}
