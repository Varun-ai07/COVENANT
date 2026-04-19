export interface LocalIpfsPayload {
  [key: string]: unknown;
}

const STORAGE_PREFIX = "covenant:ipfs:";

export function normalizeIpfsHash(input: string): string {
  const decoded = decodeURIComponent(input || "").trim();
  return decoded.replace(/^ipfs:\/\//, "").replace(/^\/ipfs\//, "").trim();
}

function generateLocalCid(): string {
  const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
  const body = seed.slice(0, 44).padEnd(44, "x");
  return `Qm${body}`;
}

export function saveLocalIpfsContent(payload: LocalIpfsPayload): string {
  const cid = generateLocalCid();

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${cid}`, JSON.stringify(payload));
    } catch {
      // Ignore storage failures; caller still receives generated CID.
    }
  }

  return cid;
}

export function loadLocalIpfsContent(hash: string): LocalIpfsPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  const normalized = normalizeIpfsHash(hash);
  if (!normalized) {
    return null;
  }

  try {
    const content = window.localStorage.getItem(`${STORAGE_PREFIX}${normalized}`);
    if (!content) {
      return null;
    }

    return JSON.parse(content) as LocalIpfsPayload;
  } catch {
    return null;
  }
}

export function isLikelyLegacyPlaceholderHash(hash: string): boolean {
  const normalized = normalizeIpfsHash(hash);
  return /^Qm[a-z0-9]{8,14}$/i.test(normalized);
}
