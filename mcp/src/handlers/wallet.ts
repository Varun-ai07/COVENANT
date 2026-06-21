/**
 * Dual-mode wallet handler for COVENANT MCP Server.
 *
 * autonomous:  Server holds private key, signs + sends txs immediately.
 * prepare-only: Returns unsigned calldata for external signing.
 *
 * Security features:
 * - Gas limit caps to prevent DoS
 * - Nonce + expiry for replay protection
 * - Permission pre-checks for sensitive operations
 */
import {
  encodeFunctionData,
  formatEther,
  type Abi,
  type Address,
  parseAbi,
  parseEther,
} from "viem";
import {
  getWalletClient,
  getPublicClient,
  getAccount,
  WALLET_MODE,
  CHAIN,
  getExplorerTxUrl,
  getExplorerAddressUrl,
  CONTRACTS,
  loadAbi,
} from "../config.js";
import type { TxResult, TxSuccess, TxPrepared, TxError } from "../types.js";
import { rpcCache } from "../lib/cache.js";

// Maximum gas limit to prevent DoS via expensive calls
const GAS_LIMIT_MAX = 10_000_000n; // 10M gas

// Gap 3: Session spending cap
let totalSessionSpent = 0n;
const MAX_SPENDING = parseEther(process.env.SPENDING_LIMIT || "0.1");

// Gap 6: Write rate limiter
let lastWriteTimestamp = 0;

// ============================================================
// Cache invalidation for write operations
// ============================================================

function invalidateCacheForWrite(
  contractAddress: Address,
  functionName: string,
  args: readonly unknown[]
): void {
  const addr = contractAddress.toLowerCase();

  // TaskEscrow writes
  if (addr === CONTRACTS.TaskEscrow?.toLowerCase()) {
    if (functionName === "createTask" || functionName === "createTaskWithPriority" || functionName === "createMilestoneTask") {
      rpcCache.invalidate("taskCount");
      rpcCache.invalidate("clientTasks");
      rpcCache.invalidate("workerTasks");
      rpcCache.invalidate("stats");
    } else if (functionName === "verifyTask" || functionName === "submitWork") {
      const taskId = args[0];
      if (typeof taskId === "bigint" || typeof taskId === "number") {
        rpcCache.invalidateTask(Number(taskId));
      }
    }
  }

  // AgentRegistry writes
  if (addr === CONTRACTS.AgentRegistry?.toLowerCase()) {
    rpcCache.invalidate("agentCount");
    rpcCache.invalidate("leaderboard");
    rpcCache.invalidate("stats");
    if (args[0] && typeof args[0] === "string") {
      rpcCache.invalidateAgent(args[0]);
    }
  }

  // OpenTaskMarket writes
  if (addr === CONTRACTS.OpenTaskMarket?.toLowerCase()) {
    rpcCache.invalidate("taskCount");
    rpcCache.invalidate("stats");
  }

  // Collective writes
  if (addr === CONTRACTS.AgentCollective?.toLowerCase()) {
    rpcCache.invalidate("collective");
  }

  // Batch writes
  if (addr === CONTRACTS.ParallelTaskBatch?.toLowerCase()) {
    rpcCache.invalidate("batch");
    rpcCache.invalidate("taskCount");
  }
}

// ============================================================
// Permission Pre-Checks
// ============================================================

/**
 * Checks if the current account has permission to execute a function.
 * Returns early error message if not allowed, preventing wasted gas.
 */
export async function checkPermission(
  contractName: string,
  functionName: string,
  args: readonly unknown[]
): Promise<{ allowed: boolean; reason?: string }> {
  const account = getAccount();
  if (!account) {
    return { allowed: false, reason: "No account configured" };
  }

  const accountAddress = account.address;

  // TaskEscrow: verifyTask - only task client
  if (contractName === "TaskEscrow" && functionName === "verifyTask") {
    const taskId = args[0] as bigint;
    try {
      const task = await readContract(CONTRACTS.TaskEscrow, loadAbi("TaskEscrow"), "getTask", [taskId]);
      if ((task as any).client !== accountAddress) {
        return { allowed: false, reason: "Only task client can verify" };
      }
    } catch {
      return { allowed: false, reason: "Task not found" };
    }
  }

  // TaskEscrow: disputeTask - only task client or worker
  if (contractName === "TaskEscrow" && functionName === "disputeTask") {
    const taskId = args[0] as bigint;
    try {
      const task = await readContract(CONTRACTS.TaskEscrow, loadAbi("TaskEscrow"), "getTask", [taskId]);
      if ((task as any).client !== accountAddress && (task as any).worker !== accountAddress) {
        return { allowed: false, reason: "Only task client or worker can dispute" };
      }
    } catch {
      return { allowed: false, reason: "Task not found" };
    }
  }

  // OpenTaskMarket: selectWorker - only task client
  if (contractName === "OpenTaskMarket" && functionName === "selectWorker") {
    const taskId = args[0] as bigint;
    try {
      const task = await readContract(CONTRACTS.OpenTaskMarket, loadAbi("OpenTaskMarket"), "getTask", [taskId]);
      if ((task as any).client !== accountAddress) {
        return { allowed: false, reason: "Only task client can select worker" };
      }
    } catch {
      return { allowed: false, reason: "Task not found" };
    }
  }

  // OpenTaskMarket: makeCounterOffer - only task client
  if (contractName === "OpenTaskMarket" && functionName === "makeCounterOffer") {
    const taskId = args[0] as bigint;
    try {
      const task = await readContract(CONTRACTS.OpenTaskMarket, loadAbi("OpenTaskMarket"), "getTask", [taskId]);
      if ((task as any).client !== accountAddress) {
        return { allowed: false, reason: "Only task client can make counter offers" };
      }
    } catch {
      return { allowed: false, reason: "Task not found" };
    }
  }

  // OpenTaskMarket: cancelTask - only task client
  if (contractName === "OpenTaskMarket" && functionName === "cancelTask") {
    const taskId = args[0] as bigint;
    try {
      const task = await readContract(CONTRACTS.OpenTaskMarket, loadAbi("OpenTaskMarket"), "getTask", [taskId]);
      if ((task as any).client !== accountAddress) {
        return { allowed: false, reason: "Only task client can cancel" };
      }
    } catch {
      return { allowed: false, reason: "Task not found" };
    }
  }

  // DisputeArbitration: castVote - only selected jurors
  if (contractName === "DisputeArbitration" && functionName === "castVote") {
    const disputeId = args[0] as bigint;
    try {
      const dispute = await readContract(
        CONTRACTS.DisputeArbitration,
        loadAbi("DisputeArbitration"),
        "getDispute",
        [disputeId]
      );
      const jurors = (dispute as any).jurors as Address[];
      if (!jurors.includes(accountAddress)) {
        return { allowed: false, reason: "Only selected jurors can vote" };
      }
    } catch {
      return { allowed: false, reason: "Dispute not found" };
    }
  }

  return { allowed: true };
}

// ============================================================
// Core execute-or-prepare function
// ============================================================

export async function executeOrPrepare(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  value?: bigint,
  contractName?: string
): Promise<TxResult> {
  // Permission check for sensitive operations
  if (contractName) {
    const permission = await checkPermission(contractName, functionName, args);
    if (!permission.allowed) {
      return {
        status: "error",
        error: permission.reason || "Permission denied",
      };
    }
  }

  if (WALLET_MODE === "prepare-only") {
    return prepareTx(contractAddress, abi, functionName, args, value);
  }

  // Gap 6: Rate limiter
  if (Date.now() - lastWriteTimestamp < 5000) {
    return {
      status: "error",
      error: "Too many transactions. Wait 5 seconds between writes.",
    };
  }

  // Gap 5: Chain validation
  const publicClient = getPublicClient();
  const chainId = await publicClient.getChainId();
  if (chainId !== 84532) {
    return {
      status: "error",
      error: "Wrong network. Please switch to Base Sepolia (chain ID 84532).",
    };
  }

  // Gap 3: Spending cap
  const txValue = value || 0n;
  if (totalSessionSpent + txValue > MAX_SPENDING) {
    return {
      status: "error",
      error: `Session spending limit reached (${formatEther(MAX_SPENDING)} ETH max). Restart server to reset.`,
    };
  }

  // Gap 1: Balance check
  const account = getAccount();
  if (account) {
    const balance = await publicClient.getBalance({ address: account.address });
    const required = txValue + parseEther("0.001");
    if (balance < required) {
      return {
        status: "error",
        error: `Insufficient balance. Have ${formatEther(balance)} ETH, need ${formatEther(required)} ETH (including 0.001 buffer).`,
      };
    }
  }

  return executeTx(contractAddress, abi, functionName, args, value);
}

// ============================================================
// Autonomous mode: sign + send immediately
// ============================================================

async function executeTx(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  value?: bigint
): Promise<TxResult> {
  const wallet = getWalletClient();
  const publicClient = getPublicClient();
  const account = getAccount();

  if (!wallet || !account) {
    return {
      status: "error",
      error: "No private key configured. Check server configuration.",
    };
  }

  try {
    // Gap 2: Gas estimation with 20% buffer
    const estimatedGas = await publicClient.estimateGas({
      address: contractAddress,
      abi,
      functionName,
      args: args as any,
      account,
      value,
    });
    const gasWithBuffer = (estimatedGas * 120n) / 100n;
    const gasPrice = await publicClient.getGasPrice();
    const estimatedGasCost = gasWithBuffer * gasPrice;

    console.error(`[TX] Estimated gas: ${gasWithBuffer} (${formatEther(estimatedGasCost)} ETH)`);

    // Estimate gas with capped limit
    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi,
      functionName,
      args: args as any,
      account,
      value,
      gas: gasWithBuffer < GAS_LIMIT_MAX ? gasWithBuffer : GAS_LIMIT_MAX,
    });

    // Send transaction
    const hash = await wallet.writeContract(request);

    console.error(`[TX] Sent: ${hash}`);
    console.error(`[TX] Explorer: ${getExplorerTxUrl(hash)}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });

    console.error(
      `[TX] Confirmed in block ${receipt.blockNumber} — gas: ${receipt.gasUsed}`
    );

    // Invalidate relevant caches after successful write
    invalidateCacheForWrite(contractAddress, functionName, args);

    // Gap 3: Update session spending
    totalSessionSpent += value || 0n;

    // Gap 6: Update rate limiter
    lastWriteTimestamp = Date.now();

    return {
      status: "success",
      txHash: hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  } catch (error: any) {
    return parseViemError(error);
  }
}

// ============================================================
// Prepare-only mode: return unsigned calldata
// ============================================================

async function prepareTx(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  value?: bigint
): Promise<TxPrepared> {
  const publicClient = getPublicClient();
  const account = getAccount();

  const data = encodeFunctionData({
    abi,
    functionName,
    args: args as any,
  });

  // Include nonce and expiry for replay protection
  let nonce = 0;
  if (account) {
    nonce = await publicClient.getTransactionCount({ address: account.address });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour expiry

  return {
    status: "prepared",
    to: contractAddress,
    data,
    value: value || 0n,
    chainId: CHAIN.id,
    nonce,
    expiresAt,
  };
}

// ============================================================
// Error parsing
// ============================================================

function parseViemError(error: any): TxError {
  const msg = error?.message || String(error);

  // Extract revert reason
  const revertMatch = msg.match(/revert(?:ed| reason)?\s*:?\s*"?([^"\n]+)"?/i);
  if (revertMatch) {
    return {
      status: "error",
      error: `Transaction reverted: ${revertMatch[1]}`,
      reason: revertMatch[1],
    };
  }

  // Gas estimation failure
  if (msg.includes("gas") || msg.includes("Gas")) {
    return {
      status: "error",
      error: "Gas estimation failed. Check contract conditions (insufficient funds, wrong arguments, or state issue).",
      reason: msg.slice(0, 200),
    };
  }

  // Insufficient funds
  if (msg.includes("insufficient funds")) {
    return {
      status: "error",
      error: "Insufficient funds for transaction.",
      reason: msg,
    };
  }

  // Contract not deployed
  if (msg.includes("contract") && msg.includes("not deployed")) {
    return {
      status: "error",
      error: "Contract not deployed at this address on the current network.",
      reason: msg,
    };
  }

  return {
    status: "error",
    error: msg.slice(0, 500),
    reason: msg,
  };
}

// ============================================================
// Read-only calls (no wallet needed) - with caching
// ============================================================

// Category mapping for cache TTLs
function getCacheCategory(functionName: string): string {
  if (functionName.startsWith("getAgent") || functionName === "getAgent" || functionName === "findAgents") return "agent";
  if (functionName.startsWith("getTask") || functionName === "getTask") return "task";
  if (functionName.includes("Count") || functionName.includes("counter")) return "taskCount";
  if (functionName.startsWith("getCollective")) return "collective";
  if (functionName.includes("Insurance") || functionName.includes("pool")) return "insurance";
  if (functionName.startsWith("getBatch")) return "batch";
  if (functionName.startsWith("getDispute")) return "dispute";
  if (functionName.includes("Stats") || functionName.includes("leaderboard")) return "stats";
  if (functionName.includes("Receipt")) return "receipt";
  return "default";
}

export async function readContract(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
  options?: { skipCache?: boolean }
): Promise<any> {
  // Skip caching for non-deterministic reads
  if (options?.skipCache) {
    return await executeRead(contractAddress, abi, functionName, args);
  }

  // Generate cache key
  const argsHash = JSON.stringify(args, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value
  ).slice(0, 100);
  const cacheKey = `read:${contractAddress}:${functionName}:${argsHash}`;
  const category = getCacheCategory(functionName);

  return rpcCache.getOrFetch(
    cacheKey,
    () => executeRead(contractAddress, abi, functionName, args),
    category
  );
}

async function executeRead(
  contractAddress: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[]
): Promise<any> {
  const publicClient = getPublicClient();

  try {
    const result = await publicClient.readContract({
      address: contractAddress,
      abi,
      functionName,
      args: args as any,
    });
    return result;
  } catch (error: any) {
    const msg = error?.message || String(error);
    throw new Error(`Contract read failed (${functionName}): ${msg.slice(0, 300)}`);
  }
}
