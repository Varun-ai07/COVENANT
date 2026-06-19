/**
 * COVENANT Demo Script
 * Full client→worker→verify flow using V5 contracts
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, toUtf8Bytes } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

const IDENTITY_ADDRESS = "0x623ff6F56754fb4CB4d60e46FF1F4AA3f34A5aAA";
const ESCROW_ADDRESS = "0x259338371e67cA712F22A95cb8b616f3926b0E4D";

const IDENTITY_ABI = [
  "function register(uint96 stake, bytes32 metadataRoot) payable",
  "function isRegistered(address) view returns (bool)",
  "function getAgent(address) view returns (tuple(address owner, uint96 stake, uint16 reputation, uint32 registeredAt, uint32 lastActivity, bool active, bytes32 metadataRoot))",
];

const ESCROW_ABI = [
  "function createTask(address worker, uint128 amount, uint32 deadline, bytes32 metaHash) payable returns (uint256)",
  "function submitWork(uint256 taskId, bytes32 deliverableHash)",
  "function completeTask(uint256 taskId, bytes calldata clientSignature)",
  "function getTask(uint256 taskId) view returns (tuple(address client, address worker, uint128 amount, uint32 deadline, uint8 status, uint8 disputeCount, bytes32 metaHash))",
  "function taskCount() view returns (uint256)",
];

async function main() {
  const clientKey = process.env.CLIENT_PRIVATE_KEY;
  const workerKey = process.env.WORKER_PRIVATE_KEY;

  if (!clientKey || !workerKey) {
    console.error("Set CLIENT_PRIVATE_KEY and WORKER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const clientAccount = privateKeyToAccount(clientKey as `0x${string}`);
  const workerAccount = privateKeyToAccount(workerKey as `0x${string}`);

  console.log("=".repeat(50));
  console.log("COVENANT Demo: Full Task Lifecycle");
  console.log("=".repeat(50));

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });

  const clientWallet = createWalletClient({
    account: clientAccount,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });

  const workerWallet = createWalletClient({
    account: workerAccount,
    chain: baseSepolia,
    transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
  });

  // Step 1: Check registration
  console.log("\n[1/6] Checking registration...");
  const clientRegistered = await publicClient.readContract({
    address: IDENTITY_ADDRESS, abi: IDENTITY_ABI,
    functionName: "isRegistered", args: [clientAccount.address],
  });
  const workerRegistered = await publicClient.readContract({
    address: IDENTITY_ADDRESS, abi: IDENTITY_ABI,
    functionName: "isRegistered", args: [workerAccount.address],
  });

  if (!clientRegistered) {
    console.log("Client not registered. Run: npx tsx register.ts");
    return;
  }
  if (!workerRegistered) {
    console.log("Worker not registered. Run: WORKER_PRIVATE_KEY=... npx tsx register.ts");
    return;
  }
  console.log("Both agents registered ✓");

  // Step 2: Create task
  console.log("\n[2/6] Creating task...");
  const metaHash = keccak256(toUtf8Bytes("Demo task - data analysis"));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const payment = parseEther("0.001");

  const { request: createReq } = await publicClient.simulateContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI,
    functionName: "createTask",
    args: [workerAccount.address, payment, deadline, metaHash],
    value: payment,
    account: clientAccount.address,
  });
  const createHash = await clientWallet.writeContract(createReq);
  await publicClient.waitForTransactionReceipt({ hash: createHash });
  console.log(`Task created ✓ (TX: ${createHash})`);

  // Step 3: Worker submits work
  console.log("\n[3/6] Worker submitting work...");
  const deliverableHash = keccak256(toUtf8Bytes("QmDeliveredCodeCID123"));

  const { request: submitReq } = await publicClient.simulateContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI,
    functionName: "submitWork",
    args: [1n, deliverableHash],
    account: workerAccount.address,
  });
  const submitHash = await workerWallet.writeContract(submitReq);
  await publicClient.waitForTransactionReceipt({ hash: submitHash });
  console.log(`Work submitted ✓ (TX: ${submitHash})`);

  // Step 4: Check task status
  console.log("\n[4/6] Checking task status...");
  const task = await publicClient.readContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI,
    functionName: "getTask", args: [1n],
  });
  console.log(`Status: ${["None","Created","Funded","Submitted","Completed","Failed","Disputed","Cancelled"][(task as any).status]}`);

  // Step 5: Client signs approval
  console.log("\n[5/6] Client approving work...");
  const message = ethers.solidityPacked(["uint256", "uint256"], [1n, (await publicClient.getChainId())]);
  const hash = ethers.keccak256(message);
  const signature = await clientWallet.signMessage({ message: ethers.getBytes(hash) });

  // Step 6: Complete task (anyone can call with valid signature)
  console.log("\n[6/6] Completing task...");
  const { request: completeReq } = await publicClient.simulateContract({
    address: ESCROW_ADDRESS, abi: ESCROW_ABI,
    functionName: "completeTask",
    args: [1n, signature],
    account: clientAccount.address,
  });
  const completeHash = await clientWallet.writeContract(completeReq);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: completeHash });

  console.log(`Task completed ✓ (TX: ${completeHash})`);
  console.log(`Worker paid! Gas used: ${receipt.gasUsed}`);

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("DEMO COMPLETE");
  console.log("=".repeat(50));
  console.log(`Client: ${clientAccount.address}`);
  console.log(`Worker: ${workerAccount.address}`);
  console.log(`Payment: ${formatEther(payment)} ETH`);
  console.log(`Gas used: ${receipt.gasUsed}`);
}

main().catch(console.error);
