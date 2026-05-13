import { parseEther, formatEther, type WalletClient, type PublicClient, type Address } from "viem";
import { AgentWalletABI } from "./abis.js";

const WALLET_FILE = ".wallets.json";

interface WalletInfo {
  walletAddress: Address;
  owner: Address;
  humanController: Address;
  dailyLimit: string;
  perTxLimit: string;
  deployedAt: string;
  network: string;
}

interface WalletsData {
  [owner: string]: WalletInfo;
}

function loadWalletsData(): WalletsData {
  try {
    const fs = await import("fs");
    if (fs.existsSync(WALLET_FILE)) {
      return JSON.parse(fs.readFileSync(WALLET_FILE, "utf8"));
    }
  } catch {}
  return {};
}

async function saveWalletInfo(info: WalletInfo) {
  const fs = await import("fs");
  const data = await loadWalletsData();
  data[info.owner] = info;
  fs.writeFileSync(WALLET_FILE, JSON.stringify(data, null, 2));
}

/**
 * Deploy an AgentWallet smart account for an autonomous agent.
 * This provides programmable spending controls with daily limits and per-transaction caps.
 *
 * @param wallet - Wallet client to deploy with
 * @param account - Account object with address
 * @param publicClient - Public client for reading blockchain state
 * @param humanController - Address of human who can override/pause (safety mechanism)
 * @param initialDailyLimit - Daily spending limit in ETH (default: 0.1 ETH)
 * @param initialPerTxLimit - Per-transaction limit in ETH (default: 0.05 ETH)
 * @returns The deployed wallet address
 */
export async function deployAgentWallet(
  wallet: WalletClient,
  account: { address: Address },
  publicClient: PublicClient,
  humanController: Address,
  initialDailyLimit: string = "0.1",
  initialPerTxLimit: string = "0.05"
): Promise<Address> {
  console.log(`\n📦 Deploying AgentWallet...`);
  console.log(`  Owner:           ${account.address}`);
  console.log(`  Human Controller: ${humanController}`);

  // Deploy the wallet contract
  const deployHash = await wallet.deployContract({
    abi: AgentWalletABI,
    bytecode: (await import("../abis/AgentWallet.json")).bytecode as `0x${string}`,
    args: [account.address, humanController],
  });

  console.log(`  Deploy TX: ${deployHash}`);
  console.log(`  Basescan: https://sepolia.basescan.org/tx/${deployHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const walletAddress = receipt.contractAddress as Address;

  if (!walletAddress) {
    throw new Error("Failed to get wallet address from deployment");
  }

  console.log(`  ✓ Wallet deployed to: ${walletAddress}`);
  console.log(`  Block: ${receipt.blockNumber}`);

  // Set initial spending limits
  const dailyLimitWei = parseEther(initialDailyLimit);
  const perTxLimitWei = parseEther(initialPerTxLimit);

  console.log(`\n⚙️  Configuring spending limits...`);
  console.log(`  Daily limit: ${initialDailyLimit} ETH`);
  console.log(`  Per-tx limit: ${initialPerTxLimit} ETH`);

  const limitsHash = await wallet.writeContract({
    address: walletAddress,
    abi: AgentWalletABI,
    functionName: "setLimits",
    args: [dailyLimitWei, perTxLimitWei],
  });

  await publicClient.waitForTransactionReceipt({ hash: limitsHash });
  console.log(`  ✓ Limits configured`);

  // Save wallet info
  await saveWalletInfo({
    walletAddress,
    owner: account.address,
    humanController,
    dailyLimit: initialDailyLimit,
    perTxLimit: initialPerTxLimit,
    deployedAt: new Date().toISOString(),
    network: "baseSepolia",
  });

  console.log(`\n✅ AgentWallet ready!`);
  console.log(`  View: https://sepolia.basescan.org/address/${walletAddress}\n`);

  return walletAddress;
}

/**
 * Execute a transaction through an AgentWallet.
 *
 * @param wallet - Wallet client
 * @param walletAddress - The AgentWallet contract address
 * @param to - Destination address
 * @param value - ETH amount to send (in wei)
 * @param data - Calldata (optional)
 * @param publicClient - Public client for waiting
 */
export async function executeThroughWallet(
  wallet: WalletClient,
  walletAddress: Address,
  to: Address,
  value: bigint,
  data: `0x${string}` = "0x",
  publicClient: PublicClient
): Promise<void> {
  console.log(`\n📤 Executing through AgentWallet...`);
  console.log(`  Wallet: ${walletAddress}`);
  console.log(`  To:     ${to}`);
  console.log(`  Value:  ${formatEther(value)} ETH`);

  const hash = await wallet.writeContract({
    address: walletAddress,
    abi: AgentWalletABI,
    functionName: "execute",
    args: [to, value, data],
  });

  console.log(`  TX: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  ✓ Executed in block ${receipt.blockNumber}`);
}

/**
 * Add an address to the wallet's allowed recipients whitelist.
 * When whitelist is non-empty, only whitelisted addresses can receive funds.
 */
export async function addAllowedRecipient(
  wallet: WalletClient,
  walletAddress: Address,
  recipient: Address,
  publicClient: PublicClient
): Promise<void> {
  const hash = await wallet.writeContract({
    address: walletAddress,
    abi: AgentWalletABI,
    functionName: "addAllowedRecipient",
    args: [recipient],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✓ Added ${recipient} to allowed recipients`);
}

/**
 * Emergency pause the wallet - stops all transactions.
 */
export async function pauseWallet(
  wallet: WalletClient,
  walletAddress: Address,
  publicClient: PublicClient
): Promise<void> {
  const hash = await wallet.writeContract({
    address: walletAddress,
    abi: AgentWalletABI,
    functionName: "emergencyPause",
    args: [],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`⚠️  Wallet ${walletAddress} is now PAUSED`);
}

/**
 * Unpause the wallet - resumes transactions.
 */
export async function unpauseWallet(
  wallet: WalletClient,
  walletAddress: Address,
  publicClient: PublicClient
): Promise<void> {
  const hash = await wallet.writeContract({
    address: walletAddress,
    abi: AgentWalletABI,
    functionName: "emergencyUnpause",
    args: [],
  });

  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`✅ Wallet ${walletAddress} is now ACTIVE`);
}

/**
 * Get wallet info - limits, whitelist, pause status.
 */
export async function getWalletInfo(
  publicClient: PublicClient,
  walletAddress: Address
): Promise<{
  dailySpendLimit: bigint;
  maxPerTransaction: bigint;
  dailySpent: bigint;
  currentDay: bigint;
  paused: boolean;
}> {
  const [dailySpendLimit, maxPerTransaction, dailySpent, currentDay, paused] = await Promise.all([
    publicClient.readContract({
      address: walletAddress,
      abi: AgentWalletABI,
      functionName: "dailySpendLimit",
      args: [],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: walletAddress,
      abi: AgentWalletABI,
      functionName: "maxPerTransaction",
      args: [],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: walletAddress,
      abi: AgentWalletABI,
      functionName: "dailySpent",
      args: [],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: walletAddress,
      abi: AgentWalletABI,
      functionName: "currentDay",
      args: [],
    }) as Promise<bigint>,
    publicClient.readContract({
      address: walletAddress,
      abi: AgentWalletABI,
      functionName: "paused",
      args: [],
    }) as Promise<boolean>,
  ]);

  return { dailySpendLimit, maxPerTransaction, dailySpent, currentDay, paused };
}
