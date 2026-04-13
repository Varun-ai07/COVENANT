import { createWalletClient, createPublicClient, http, Address, encodeFunctionData, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import * as dotenv from "dotenv";
import { CONTRACTS, createWallet } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI, AgentCollectiveABI } from "./lib/abis.js";
import { uploadToIPFS, downloadFromIPFS } from "./lib/ipfs.js";
import { generateJSON } from "./lib/llm.js";
import { safeSubmit } from "./lib/safe.js";
import { EventListener } from "./lib/eventListener.js";

dotenv.config();

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const CHAIN = baseSepolia;

// Re-export createWallet for external use
export { createWallet };

/**
 * Collective Agent - Handles 2D enhancements: Agent Collective funding
 * Multiple agents pool resources to fund tasks none could afford alone
 */
export class CollectiveAgent {
  private walletClient: any;
  private account: any;
  private publicClient: any;

  constructor(privateKey: string) {
    const { wallet, account, publicClient } = createWallet(privateKey);
    this.walletClient = wallet;
    this.account = account;
    this.publicClient = publicClient;
  }

  /**
   * Create a new collective for pooling funds
   */
  async createCollective(
    minContribution: number, // in ETH
    maxMembers: number
  ): Promise<string> {
    console.log("\n=== CREATING COLLECTIVE ===");
    console.log(`Min contribution per member: ${minContribution} ETH`);
    console.log(`Max members: ${maxMembers}`);

    const minContributionWei = parseEther(minContribution.toString());

    const createData = encodeFunctionData({
      abi: AgentCollectiveABI,
      functionName: "createCollective",
      args: [minContributionWei, maxMembers],
    });

    const hash = await safeSubmit(this.publicClient, this.walletClient, {
      to: CONTRACTS.AgentCollective,
      data: createData,
      value: minContributionWei, // Creator contributes minimum amount
    });

    console.log(`Collective created. TX: ${hash}`);
    return hash;
  }

  /**
   * Join an existing collective
   */
  async joinCollective(collectiveId: bigint, contribution: number): Promise<string> {
    console.log("\n=== JOINING COLLECTIVE ===");
    console.log(`Collective ID: ${collectiveId}`);
    console.log(`Contribution: ${contribution} ETH`);

    const contributionWei = parseEther(contribution.toString());

    const joinData = encodeFunctionData({
      abi: AgentCollectiveABI,
      functionName: "joinCollective",
      args: [collectiveId],
    });

    const hash = await safeSubmit(this.publicClient, this.walletClient, {
      to: CONTRACTS.AgentCollective,
      data: joinData,
      value: contributionWei,
    });

    console.log(`Joined collective. TX: ${hash}`);
    return hash;
  }

  /**
   * Launch a task using pooled funds
   */
  async launchTask(
    collectiveId: bigint,
    workerAddress: `0x${string}`,
    payment: number, // in ETH
    deadline: number, // unix timestamp
    descriptionHash: `0x${string}`
  ): Promise<string> {
    console.log("\n=== LAUNCHING TASK FROM COLLECTIVE ===");
    console.log(`Collective ID: ${collectiveId}`);
    console.log(`Worker: ${workerAddress}`);
    console.log(`Payment: ${payment} ETH`);

    const paymentWei = parseEther(payment.toString());

    const launchData = encodeFunctionData({
      abi: AgentCollectiveABI,
      functionName: "launchTask",
      args: [collectiveId, workerAddress, paymentWei, BigInt(deadline), descriptionHash],
    });

    const hash = await safeSubmit(this.publicClient, this.walletClient, {
      to: CONTRACTS.AgentCollective,
      data: launchData,
    });

    console.log(`Task launched from collective. TX: ${hash}`);
    return hash;
  }

  /**
   * Claim deliverable from a completed collective task
   */
  async claimDeliverable(collectiveId: bigint): Promise<string> {
    console.log("\n=== CLAIMING DELIVERABLE FROM COLLECTIVE ===");
    console.log(`Collective ID: ${collectiveId}`);

    const claimData = encodeFunctionData({
      abi: AgentCollectiveABI,
      functionName: "claimDeliverable",
      args: [collectiveId],
    });

    const hash = await safeSubmit(this.publicClient, this.walletClient, {
      to: CONTRACTS.AgentCollective,
      data: claimData,
    });

    console.log(`Deliverable claimed. TX: ${hash}`);
    return hash;
  }

  /**
   * Get collective details
   */
  async getCollectiveDetails(collectiveId: bigint): Promise<any> {
    try {
      const result = await this.publicClient.readContract({
        address: CONTRACTS.AgentCollective,
        abi: AgentCollectiveABI,
        functionName: "getCollective",
        args: [collectiveId],
      }) as any;

      return {
        creator: result[0],
        members: result[1],
        totalFund: result[2],
        selectedWorker: result[3],
        taskId: result[4],
        deliverableHash: result[5],
        distributed: result[6],
        maxMembers: result[7]
      };
    } catch (error) {
      console.error("Error getting collective details:", error);
      throw error;
    }
  }

  /**
   * Run collective agent in daemon mode (monitoring for opportunities)
   */
  async runDaemon(): Promise<void> {
    console.log("\n[COLLECTIVE DAEMON] Starting collective agent in daemon mode...");
    console.log("[COLLECTIVE DAEMON] Will monitor for collective creation opportunities");

    try {
      const wsUrl = process.env.BASE_SEPOLIA_RPC_URL?.replace('https', 'wss')?.replace('http', 'ws') || 'wss://sepolia.base.org';
      const eventListener = new EventListener(wsUrl);

      // Listen for CollectiveCreated events
      eventListener.subscribe(
        CONTRACTS.AgentCollective,
        AgentCollectiveABI,
        'CollectiveCreated',
        async (event) => {
          const collectiveId = event.args.collectiveId as bigint;
          const creator = event.args.creator as string;
          const minContribution = event.args.minContribution as bigint;
          const maxMembers = event.args.maxMembers as bigint;

          console.log(`\n[EVENT] CollectiveCreated: #${collectiveId}`);
          console.log(`  Creator: ${creator}`);
          console.log(`  Min contribution: ${formatEther(minContribution)} ETH`);
          console.log(`  Max members: ${maxMembers}`);

          // Auto-join if we have sufficient balance and it's not full
          // In a real implementation, this would involve more sophisticated logic
        }
      );

      console.log("[COLLECTIVE DAEMON] Listening for AgentCollective events...");
      console.log("[COLLECTIVE DAEMON] Press Ctrl+C to stop.");

      // Keep alive
      await new Promise(() => {});
    } catch (error) {
      console.error("[COLLECTIVE DAEMON] Error:", error);
      process.exit(1);
    }
  }

  /**
   * Full flow: create collective, invite members, launch task, claim results
   */
  async executeCollectiveFlow(
    taskDescription: string,
    budgetPerMember: number, // in ETH
    minMembers: number,
    maxMembers: number,
    availableWorkers: Array<{
      address: `0x${string}`;
      capabilities: string[];
      reputation: number;
    }>
  ): Promise<void> {
    console.log("\n=== COLLECTIVE AGENT: EXECUTING COLLECTIVE FLOW ===");
    console.log(`Task: ${taskDescription}`);
    console.log(`Budget per member: ${budgetPerMember} ETH`);
    console.log(`Target members: ${minMembers}-${maxMembers}`);
    console.log(`Available Workers: ${availableWorkers.length}`);

    // Step 1: Create collective
    console.log("\nStep 1: Creating collective...");
    const minContribution = budgetPerMember;
    const createTx = await this.createCollective(minContribution, maxMembers);
    console.log(`Collective creation tx: ${createTx}`);

    // Step 2: Wait for transaction to be mined and get collective ID
    // In a real implementation, we would parse events properly
    // For simplicity, we'll assume collective ID 1 for demonstration
    const collectiveId = 1n;
    console.log(`Assuming collective ID: ${collectiveId}`);

    // Step 3: Invite additional members (simulated)
    console.log("\nStep 3: Inviting additional members...");
    const additionalMembers = Math.max(0, minMembers - 1); // Subtract 1 for creator
    console.log(`Would invite ${additionalMembers} additional members`);

    // Step 4: Launch task using pooled funds
    console.log("\nStep 4: Launching task from collective...");
    // In a real implementation, we would:
    // 1. Wait for enough members to join
    // 2. Select optimal worker using LLM
    // 3. Calculate total budget
    // 4. Launch task
    // For now, we'll simulate with predefined values
    const totalBudget = minContribution * minMembers;
    const worker = availableWorkers[0]?.address || "0x0000000000000000000000000000000000000001";
    const payment = totalBudget * 0.8; // Use 80% for task, keep 20% as buffer
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours
    const descriptionHash = `0x${"task-description-hash".toString(16).padStart(64, "0")}` as `0x${string}`;

    const launchTx = await this.launchTask(collectiveId, worker as `0x${string}`, payment, deadline, descriptionHash);
    console.log(`Task launch tx: ${launchTx}`);

    // Step 5: Wait for task completion (simulated)
    console.log("\nStep 5: Waiting for task completion...");
    console.log("In a real implementation, we would monitor the task via events");

    // Step 6: Claim deliverable
    console.log("\nStep 6: Claiming deliverable from collective...");
    const claimTx = await this.claimDeliverable(collectiveId);
    console.log(`Deliverable claim tx: ${claimTx}`);

    console.log("\n=== COLLECTIVE AGENT: FLOW COMPLETE ===");
  }
}

// ==================== MAIN ====================

async function main() {
  const { COLLECTIVE_PRIVATE_KEY } = process.env;

  if (!COLLECTIVE_PRIVATE_KEY) {
    console.error("Missing COLLECTIVE_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const agent = new CollectiveAgent(COLLECTIVE_PRIVATE_KEY);

  console.log("=== COLLECTIVE AGENT ===");
  console.log(`Address: ${agent.account.address}`);

  // Check balance
  const balance = await agent.publicClient.getBalance({ address: agent.account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);

  const args = process.argv.slice(2);
  if (args.includes('--daemon') || args.includes('--listen')) {
    await agent.runDaemon();
  } else {
    // Example: run a sample collective flow (or could be driven by CLI args)
    console.log("\n[DEMO] Running sample collective flow...");
    // In a real scenario, you'd fetch available workers from registry
    // For now, just show the capability
    console.log("Use --daemon to start event-driven collective agent.");
  }
}

main().catch(console.error);