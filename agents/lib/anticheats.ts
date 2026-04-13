/**
 * Anticheat measures for VerifierBot
 * Prevents timing attacks, proxy detection, and other circumvention attempts
 */

export interface AnticheatConfig {
  minDelayMs: number;
  maxDelayMs: number;
  enableProxyRotation: boolean;
  enableUserAgentRotation: boolean;
}

const DEFAULT_CONFIG: AnticheatConfig = {
  minDelayMs: 0,
  maxDelayMs: 5 * 60 * 1000, // 5 minutes
  enableProxyRotation: false,
  enableUserAgentRotation: false,
};

/**
 * Sleep for a random duration within configured range
 * This prevents timing attacks where workers could serve special responses
 * exactly when the verifier starts checking.
 */
export async function randomDelay(config: Partial<AnticheatConfig> = {}): Promise<void> {
  const { minDelayMs, maxDelayMs } = { ...DEFAULT_CONFIG, ...config };

  const delayMs = Math.floor(Math.random() * (maxDelayMs - minDelayMs + 1)) + minDelayMs;

  if (delayMs > 0) {
    console.log(`[Anticheat] Sleeping for ${(delayMs / 1000).toFixed(1)}s to prevent timing attacks...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

/**
 * Get a random proxy from configured proxy list
 * (Not implemented in initial version, but structure ready)
 */
export function getRandomProxy(): string | null {
  // TODO: Implement proxy rotation if needed
  return null;
}

/**
 * Get a random user agent to prevent fingerprinting
 */
export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (compatible; COVENANT-Bot/1.0; +https://covenantProtocol.org)',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * Validate temporal consistency of task submission
 * Checks that the task wasn't submitted in the future or too far in the past
 */
export function validateSubmissionTime(submittedAt: string, deadline: bigint): boolean {
  const submissionTime = new Date(submittedAt).getTime();
  const now = Date.now();
  const deadlineTime = Number(deadline) * 1000;

  // Allow 5 minutes clock skew
  const fiveMinutes = 5 * 60 * 1000;

  if (submissionTime > now + fiveMinutes) {
    console.warn(`[Anticheat] Task submitted in the future: ${submittedAt}`);
    return false;
  }

  if (submissionTime > deadlineTime + fiveMinutes) {
    console.warn(`[Anticheat] Task submitted after deadline: ${submittedAt}`);
    return false;
  }

  return true;
}

/**
 * Check for rapid successive submissions from same worker (potential automation)
 * Returns true if the pattern looks suspicious
 */
export function checkSubmissionRate(submissionTimes: string[]): boolean {
  if (submissionTimes.length < 2) return false;

  // Sort times
  const times = submissionTimes.map(t => new Date(t).getTime()).sort((a, b) => a - b);

  // Check if any two submissions are less than 2 seconds apart
  for (let i = 1; i < times.length; i++) {
    const diff = times[i] - times[i-1];
    if (diff < 2000) {
      console.warn(`[Anticheat] Rapid submissions detected: ${diff}ms apart`);
      return true; // suspicious
    }
  }

  return false;
}
