/**
 * COVENANT Agent Registration Script
 * Registers an AI agent on-chain with V5 CovenantIdentity contract
 */
import { createPublicClient, createWalletClient, http, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const IDENTITY_ADDRESS = "0x623ff6F56754fb4CB4d60e46FF1F4AA3f34A5aAA";

const IDENTITY_ABI = [
  "function register(uint96 stake, bytes32 metadataRoot) payable",
  "function isRegistered(address) view returns (bool)",
  "function getAgent(address) view returns (tuple(address owner, uint96 stake, uint16 reputation, uint32 registeredAt, uint32 lastActivity, bool active, bytes32 metadataRoot))",
];

async function main() {
  const privateKey = process.env.CLIENT_PRIVATE_KEY || process.env.WORKER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set CLIENT_PRIVATE_KEY or WORKER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log(`Registering agent: ${account.address}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });

  // Check if already registered
  const isRegistered = await publicClient.readContract({
    address: IDENTITY_ADDRESS,
    abi: IDENTITY_ABI,
    functionName: "isRegistered",
    args: [account.address],
  });

  if (isRegistered) {
    console.log("Agent already registered!");
    const agent = await publicClient.readContract({
      address: IDENTITY_ADDRESS,
      abi: IDENTITY_ABI,
      functionName: "getAgent",
      args: [account.address],
    });
    console.log("Reputation:", (agent as any).reputation);
    console.log("Stake:", ethers.formatEther((agent as any).stakedAmount), "ETH");
    return;
  }

  // Register
  const metadataRoot = ethers.keccak256(ethers.toUtf8Bytes(`agent-${account.address}-${Date.now()}`));
  const stake = parseEther("0.001");

  const { request } = await publicClient.simulateContract({
    address: IDENTITY_ADDRESS,
    abi: IDENTITY_ABI,
    functionName: "register",
    args: [0, metadataRoot],
    value: stake,
    account: account.address,
  });

  const hash = await walletClient.writeContract(request);
  console.log(`TX: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log("Gas used:", receipt.gasUsed.toString());
}

main().catch(console.error);
