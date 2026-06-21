import { formatEther, parseEther } from "viem";

// ─── Response Types ───────────────────────────────────────────

export interface SuccessResponse {
  success: true;
  summary: string;
  data: Record<string, unknown>;
  txHash?: string;
  basescanUrl?: string;
  nextSteps?: string[];
  workflowState?: Record<string, unknown>;
}

export interface ErrorResponse {
  success: false;
  error: string;
  cause: string;
  fix: string;
  retryable: boolean;
}

// ─── Success Formatter ────────────────────────────────────────

export function formatSuccess(
  summary: string,
  data: Record<string, unknown>,
  txHash?: string,
  nextSteps?: string[],
  workflowState?: Record<string, unknown>
): { content: Array<{ type: "text"; text: string }> } {
  const response: SuccessResponse = {
    success: true,
    summary,
    data,
    ...(txHash && {
      txHash,
      basescanUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    }),
    ...(nextSteps && { nextSteps }),
    ...(workflowState && { workflowState }),
  };
  return {
    content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
  };
}

// ─── Error Formatter ──────────────────────────────────────────

export function formatStructuredError(
  error: string,
  cause: string,
  fix: string,
  retryable = true
): { isError: false; content: Array<{ type: "text"; text: string }> } {
  return {
    isError: false,
    content: [{ type: "text", text: `${error}\n\nWhat happened: ${cause}\n\nNext step: ${fix}` }],
  };
}

// ─── Contract Error Parser ────────────────────────────────────

export function parseContractError(err: unknown): ErrorResponse {
  const msg = String(err);

  if (msg.includes("InsufficientStake")) {
    return { success: false, error: "Registration failed: wallet does not have enough ETH for the stake deposit.", cause: "The wallet needs at least 0.001 ETH for the stake plus ~0.0002 ETH for gas.", fix: "Get free testnet ETH at https://app.optimism.io/faucet (select Base Sepolia). Then retry corven_register_agent.", retryable: true };
  }
  if (msg.includes("AlreadyRegistered")) {
    return { success: false, error: "This wallet address is already registered as an agent.", cause: "corven_register_agent can only be called once per wallet address.", fix: "Use corven_get_agent with this wallet address to see the existing profile.", retryable: false };
  }
  if (msg.includes("AgentNotActive") || msg.includes("NotRegistered")) {
    return { success: false, error: "The specified agent address is not registered or has been deactivated.", cause: "Either the wallet has never called corven_register_agent, or the agent was deactivated.", fix: "Call corven_get_agent with the address to check status. If not registered, call corven_register_agent first.", retryable: false };
  }
  if (msg.includes("InvalidStatus")) {
    return { success: false, error: "This operation cannot be performed on a task in its current status.", cause: "Each task function is only valid at specific lifecycle states.", fix: "Call corven_get_task to see the current status. Funded -> corven_submit_work. Submitted -> corven_verify_task or corven_dispute_task.", retryable: false };
  }
  if (msg.includes("DeadlinePassed")) {
    return { success: false, error: "The task deadline has already passed.", cause: "The Unix timestamp deadline set when the task was created has elapsed.", fix: "The task is now in Failed state. Call corven_get_task to confirm. If the worker submitted before deadline, call corven_dispute_task.", retryable: false };
  }
  if (msg.includes("NotAuthorized") || msg.includes("OwnableUnauthorizedAccount") || msg.includes("Unauthorized")) {
    return { success: false, error: "Your wallet does not have permission to call this function.", cause: "Only the designated client, worker, or contract owner can call this function.", fix: "Ensure PRIVATE_KEY in your environment matches the client or worker address for this task.", retryable: false };
  }
  if (msg.includes("insufficient funds") || msg.includes("InsufficientFunds")) {
    return { success: false, error: "Wallet does not have enough ETH to cover this transaction.", cause: "The total cost (payment amount + gas fee) exceeds the wallet balance.", fix: "Get free testnet ETH at https://app.optimism.io/faucet (select Base Sepolia). You need the payment amount plus approximately 0.0005 ETH for gas.", retryable: true };
  }
  if (msg.includes("SelfHire")) {
    return { success: false, error: "You cannot hire yourself as the worker for your own task.", cause: "The client and worker wallet addresses must be different.", fix: "Call corven_find_workers to find a different registered agent.", retryable: false };
  }
  if (msg.includes("TaskNotFound") || msg.includes("task not found")) {
    return { success: false, error: "No task found with that ID.", cause: "The taskId does not exist on this contract.", fix: "Call corven_get_client_tasks or corven_get_worker_tasks with your wallet address to find valid task IDs.", retryable: false };
  }
  if (msg.includes("BidAlreadySubmitted")) {
    return { success: false, error: "You have already submitted a bid on this task.", cause: "Only one bid per worker per open task is allowed.", fix: "Call corven_get_bid to see your existing bid. To change your offer, call corven_withdraw_bid first, then resubmit.", retryable: false };
  }
  if (msg.includes("IPFS") || msg.includes("ipfs")) {
    return { success: false, error: "IPFS hash could not be resolved.", cause: "The IPFS CID provided is not reachable through any gateway.", fix: "Re-upload your content to Pinata (pinata.cloud) and use the returned CID. Wait 30 seconds after upload for propagation.", retryable: true };
  }

  return { success: false, error: "Transaction failed with an unexpected error.", cause: msg.slice(0, 300), fix: "Verify all parameters are correct format (ETH as decimal strings, addresses as full 42-char 0x... values). Check wallet has enough ETH for gas.", retryable: true };
}

// ─── Pre-flight Validators ────────────────────────────────────

export async function validateWorkerRegistered(
  registry: any,
  workerAddress: string
): Promise<ErrorResponse | null> {
  try {
    const worker = await registry.read.agents([workerAddress as `0x${string}`]);
    if (!worker.isActive) {
      return { success: false, error: `Worker address ${workerAddress} is not registered or has been deactivated.`, cause: "The TaskEscrow contract will reject tasks for unregistered workers.", fix: "Call corven_find_workers with the required capability to find registered workers.", retryable: false };
    }
  } catch {
    return { success: false, error: `Could not verify worker ${workerAddress} -- address may not be registered.`, cause: "Registry lookup failed for this address.", fix: "Call corven_get_agent with the worker address to check registration.", retryable: false };
  }
  return null;
}

export async function validateBalance(
  publicClient: any,
  address: `0x${string}`,
  requiredEth: string,
  gasBufferEth = "0.0005"
): Promise<ErrorResponse | null> {
  const balance = await publicClient.getBalance({ address });
  const required = parseEther(requiredEth) + parseEther(gasBufferEth);
  if (balance < required) {
    return { success: false, error: `Insufficient ETH. Need ${formatEther(required)} ETH total, wallet has ${formatEther(balance)} ETH.`, cause: "Wallet balance does not cover payment amount plus gas fees.", fix: `Get free testnet ETH at https://app.optimism.io/faucet (select Base Sepolia). Add at least ${formatEther(required - balance)} ETH more.`, retryable: true };
  }
  return null;
}
