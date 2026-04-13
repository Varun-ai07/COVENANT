import * as dotenv from "dotenv";
import { formatEther, parseEther } from "viem";
import { createWallet, CONTRACTS, CHAIN, RPC_URL } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI, OpenTaskMarketABI } from "./lib/abis.js";
import { generateKeyPair, deriveSharedSecret, decrypt, fromHex, toHex } from "./lib/crypto.js";
import { uploadToIPFS, downloadFromIPFS, isPinataConfigured } from "./lib/ipfs.js";
import { generateCompletion } from "./lib/llm.js";
import { safeSubmit } from "./lib/safe.js";
import { encodeFunctionData } from "viem";
import { EventListener } from "./lib/eventListener";

dotenv.config();

interface OpenTaskInfo {
  taskId: bigint;
  client: string;
  maxPayment: bigint;
  deadline: bigint;
  descriptionHash: string;
  status: number; // OpenTaskStatus enum value
  postedAt: bigint;
}

interface BidInfo {
  price: bigint;
  timeEstimate: number;
  proposalHash: string;
  bidAt: bigint;
  bidder: string;
}

/**
 * Bidder Agent - Specializes in finding and bidding on open tasks
 * Implements 2B enhancement: One-to-many (client broadcasts to multiple workers)
 */
export class BidderAgent {
  private walletClient: ReturnType<typeof createWallet>["wallet"];
  private account: ReturnType<typeof createWallet>["account"];
  private publicClient: ReturnType<typeof createWallet>["publicClient"];
  private openTaskMarket: any;
  private eventListener?: EventListener;
  private seenTasks: Set<bigint> = new Set();

  constructor(privateKey: string) {
    const { wallet, account, publicClient } = createWallet(privateKey);
    this.walletClient = wallet;
    this.account = account;
    this.publicClient = publicClient;

    // Initialize OpenTaskMarket contract instance
    this.openTaskMarket = this.publicClient.getContract({
      address: CONTRACTS.OpenTaskMarket,
      abi: OpenTaskMarketABI,
    });
  }

  /**
   * Check for open tasks and bid on suitable ones
   * @param maxBidsPerCycle Maximum number of bids to place in one cycle
   */
  async checkAndBidOnOpenTasks(maxBidsPerCycle = 3): Promise<void> {
    console.log("=== BIDDER AGENT: CHECKING FOR OPEN TASKS ===");
    console.log(`Address: ${this.account.address}`);

    try {
      // Get the number of open tasks posted
      const taskCount = await this.publicClient.readContract({
        address: CONTRACTS.OpenTaskMarket,
        abi: OpenTaskMarketABI,
        functionName: "taskCounter"
      }) as bigint;

      console.log(`Found ${taskCount} total tasks in the market`);

      // Check each task to see if it's open and suitable for bidding
      const maxTasksToCheck = Math.min(Number(taskCount), 20); // Limit to prevent excessive calls
      let bidsPlaced = 0;

      for (let i = 1; i <= maxTasksToCheck && bidsPlaced < maxBidsPerCycle; i++) {
        try {
          const taskData = await this.publicClient.readContract({
            address: CONTRACTS.OpenTaskMarket,
            abi: OpenTaskMarketABI,
            functionName: "getTask",
            args: [i]
          }) as any;

          const task: OpenTaskInfo = {
            taskId: BigInt(i),
            client: taskData[0],
            maxPayment: taskData[1],
            deadline: taskData[2],
            descriptionHash: taskData[3],
            // bidders: taskData[4], // We could check this but skipping for simplicity
            // selectedWorker: taskData[5],
            status: Number(taskData[6]),
            postedAt: taskData[7]
          };

          // Only bid on open tasks (status 0 = Open)
          if (task.status !== 0) {
            continue;
          }

          // Check if we've already bid on this task
          const alreadyBid = await this.hasAlreadyBidOnTask(i);
          if (alreadyBid) {
            console.log(`Task #${i}: Already bid, skipping`);
            continue;
          }

          // Check if task matches our capabilities
          const hasCapability = await this.taskMatchesCapabilities(task.descriptionHash);
          if (!hasCapability) {
            console.log(`Task #${i}: Doesn't match capabilities, skipping`);
            continue;
          }

          // Check if payment is acceptable (we want at least 30% of max payment)
          const minAcceptable = task.maxPayment * 30n / 100n;
          if (task.maxPayment < minAcceptable) {
            console.log(`Task #${i}: Payment too low, skipping`);
            continue;
          }

          // Generate a bid using LLM for proposal and time estimate
          console.log(`\nEvaluating Task #${i}...`);
          const bidDetails = await this.generateBidDetails(task);

          console.log(`  Bidding ${formatEther(bidDetails.price)} ETH, ${bidDetails.timeEstimate}s estimate`);

          // Submit the bid
          const bidData = encodeFunctionData({
            abi: OpenTaskMarketABI,
            functionName: "submitBid",
            args: [
              task.taskId,
              bidDetails.price,
              bidDetails.timeEstimate,
              bidDetails.proposalHash
            ]
          });

          const hash = await safeSubmit(
            this.publicClient,
            this.walletClient,
            {
              to: CONTRACTS.OpenTaskMarket,
              data: bidData,
              value: 0
            }
          );

          console.log(`  Bid submitted! Tx: ${hash}`);
          bidsPlaced++;

          // Wait a bit between bids to avoid rate limiting
          if (bidsPlaced < maxBidsPerCycle) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          // Individual task errors shouldn't stop us from checking others
          console.log(`  Error checking/bidding on task #${i}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }
      }

      if (bidsPlaced === 0) {
        console.log("No suitable open tasks found for bidding");
      } else {
        console.log(`\nPlaced ${bidsPlaced} bids on open tasks`);
      }
    } catch (error) {
      console.error("Error checking open tasks:", error);
    }
  }

  /**
   * Check if we've already bid on a specific task
   */
  private async hasAlreadyBidOnTask(taskId: bigint): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: CONTRACTS.OpenTaskMarket,
        abi: OpenTaskMarketABI,
        functionName: "getBid",
        args: [taskId, this.account.address],
      }) as bigint[];
      // getBid returns [price, timeEstimate, proposal, bidAt, bidder]
      const price = result[0];
      return price > 0n;
    } catch (error) {
      console.error("Error checking bid history:", error);
      return false; // Assume we haven't bid on error
    }
  }

  /**
   * Check if a task matches our capabilities
   * @param descriptionHash IPFS hash of task description
   */
  private async taskMatchesCapabilities(descriptionHash: `0x${string}`): Promise<boolean> {
    try {
      // Download and parse task details
      const taskDetails = await downloadFromIPFS(descriptionHash);
      const taskJson = JSON.parse(taskDetails);
      const taskTitle = (taskJson.title || "").toLowerCase();
      const taskDescription = (taskJson.description || "").toLowerCase();

      // Define our capabilities (in a real implementation, this would come from config/profile)
      const ourCapabilities = [
        "data-analysis",
        "research",
        "content-generation",
        "code-review",
        "market-analysis",
        "technical-writing"
      ];

      // Check if any of our capabilities match the task
      return ourCapabilities.some(capability =>
        taskTitle.includes(capability) ||
        taskDescription.includes(capability)
      );
    } catch (error) {
      console.error("Error checking task capabilities:", error);
      // If we can't check, assume it doesn't match to be safe
      return false;
    }
  }

  /**
   * Generate bid details using LLM for proposal and time estimate
   * @param task The task to bid on
   */
  private async generateBidDetails(task: OpenTaskInfo): Promise<{
    price: bigint;
    timeEstimate: number;
    proposalHash: `0x${string}`;
  }> {
    try {
      // Download task details
      const taskDetails = await downloadFromIPFS(task.descriptionHash);
      const taskJson = JSON.parse(taskDetails);

      // Create prompt for LLM to generate bid
      const prompt = `
        You are bidding on an open task as an autonomous AI agent.

        Task Details:
        - Title: ${taskJson.title || "No title"}
        - Description: ${taskJson.description || "No description"}
        - Instructions: ${taskJson.instructions || "No specific instructions"}
        - Max Payment: ${formatEther(task.maxPayment)} ETH
        - Deadline: ${new Date(Number(task.deadline) * 1000).toISOString()}

        Based on the task details, please provide:
        1. Your proposed price (in ETH) - should be between 30% and 100% of max payment
        2. Estimated time to complete (in seconds)
        3. A brief proposal/approach for how you would complete the task

        Format your response as JSON:
        {
          "priceEth": "0.005",
          "timeEstimateSeconds": 3600,
          "proposal": "Brief description of your approach..."
        }

        Consider:
        - Your reputation and expertise
        - Task complexity and requirements
        - Current market conditions
        - The need to deliver quality work to maintain reputation
      `;

      const llmResponse = await generateCompletion(prompt, { maxTokens: 500 });

      // Parse LLM response (with fallback)
      let priceEth = parseEther("0.001"); // Default minimum
      let timeEstimateSeconds = 1800; // Default 30 minutes
      let proposal = "Standard approach to complete the task";

      try {
        // Try to extract JSON from response
        const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.priceEth) {
            priceEth = parseEther(parsed.priceEth);
          }
          if (parsed.timeEstimateSeconds) {
            timeEstimateSeconds = parseInt(parsed.timeEstimateSeconds);
          }
          if (parsed.proposal) {
            proposal = parsed.proposal;
          }
        }
      } catch (parseError) {
        console.warn("Could not parse LLM response as JSON, using defaults");
        // Fallback to simple extraction
        if (llmResponse.includes("ETH")) {
          const ethMatch = llmResponse.match(/(\d+\.?\d*)\s*ETH/i);
          if (ethMatch) {
            priceEth = parseEther(ethMatch[1]);
          }
        }
        const timeMatch = llmResponse.match(/(\d+)\s*(?:seconds?|secs?)/i);
        if (timeMatch) {
          timeEstimateSeconds = parseInt(timeMatch[1]);
        }
        if (llmResponse.length > 50) {
          proposal = llmResponse.substring(0, 200);
        }
      }

      // Ensure price is within acceptable bounds
      const maxPrice = task.maxPayment;
      const minPrice = maxPrice * 30n / 100n; // At least 30% of max
      if (priceEth > maxPrice) {
        priceEth = maxPrice;
      }
      if (priceEth < minPrice) {
        priceEth = minPrice;
      }

      // Generate a mock proposal hash (in reality, this would be IPFS hash of proposal document)
      const proposalHash = `0x${Buffer.from(proposal).toString('hex').padStart(64, '0')}` as `0x${string}`;

      return {
        price: priceEth,
        timeEstimate: timeEstimateSeconds,
        proposalHash
      };
    } catch (error) {
      console.error("Error generating bid details:", error);
      // Return safe defaults
      return {
        price: task.maxPayment * 50n / 100n, // 50% of max payment
        timeEstimate: 3600, // 1 hour
        proposalHash: "0x736166652064656661756c742070726f706f73616c2068617368" as `0x${string}` // "safe default proposal hash"
      };
    }
  }

  /**
   * Withdraw a bid from a task (only if not yet selected)
   * @param taskId The ID of the task to withdraw from
   */
  async withdrawBid(taskId: number): Promise<void> {
    try {
      console.log(`Attempting to withdraw bid from task #${taskId}...`);

      const withdrawData = encodeFunctionData({
        abi: OpenTaskMarketABI,
        functionName: "withdrawBid",
        args: [taskId]
      });

      const hash = await safeSubmit(
        this.publicClient,
        this.walletClient,
        {
          to: CONTRACTS.OpenTaskMarket,
          data: withdrawData
        }
      );

      console.log(`Bid withdrawn! Tx: ${hash}`);
    } catch (error) {
      console.error("Error withdrawing bid:", error);
      throw error;
    }
  }

  /**
   * Get details of a specific task
   * @param taskId The ID of the task
   */
  async getTaskDetails(taskId: number): Promise<any> {
    try {
      const taskData = await this.publicClient.readContract({
        address: CONTRACTS.OpenTaskMarket,
        abi: OpenTaskMarketABI,
        functionName: "getTask",
        args: [taskId]
      }) as any;

      return {
        taskId: BigInt(taskId),
        client: taskData[0],
        maxPayment: taskData[1],
        deadline: taskData[2],
        descriptionHash: taskData[3],
        bidders: taskData[4],
        selectedWorker: taskData[5],
        status: Number(taskData[6]),
        postedAt: taskData[7]
      };
    } catch (error) {
      console.error("Error getting task details:", error);
      throw error;
    }
  }

  /**
   * Get all bids placed by this bidder
   */
  async getMyBids(): Promise<Array<{
    taskId: bigint;
    bid: BidInfo;
  }>> {
    // In a real implementation, we'd need to track our bids or query through events
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Handle a counter-offer event (called by daemon mode)
   * Automatically decides to accept or reject based on simple policy
   */
  async handleCounterOffer(taskId: bigint): Promise<void> {
    try {
      // Check if we have a bid on this task
      const bid = await this.publicClient.readContract({
        address: CONTRACTS.OpenTaskMarket,
        abi: OpenTaskMarketABI,
        functionName: "getBid",
        args: [taskId, this.account.address],
      }) as any;

      // If no bid or bid price is 0, ignore
      const originalPrice = bid[0];
      if (originalPrice === 0n) {
        console.log(`[CounterOffer] No bid found for task #${taskId}, ignoring`);
        return;
      }

      // Get the full task to see the counter-offer details
      const taskData = await this.publicClient.readContract({
        address: CONTRACTS.OpenTaskMarket,
        abi: OpenTaskMarketABI,
        functionName: "getTask",
        args: [taskId],
      }) as any;

      const bidStorage = taskData.bids[this.account.address.toLowerCase()];
      if (!bidStorage || !bidStorage.hasCounter) {
        console.log(`[CounterOffer] No counter-offer found for task #${taskId}, ignoring`);
        return;
      }

      const counterPrice = bidStorage.counterPrice;
      const counterTimeEstimate = Number(bidStorage.counterTimeEstimate);

      console.log(`[CounterOffer] Evaluating: original=${formatEther(originalPrice)} ETH, counter=${formatEther(counterPrice)} ETH`);

      // Simple policy: Accept if counter price >= 90% of original, else reject.
      // This can be refined based on agent strategy.
      const minAcceptable = originalPrice * 90n / 100n;
      let accept = false;
      if (counterPrice >= minAcceptable) {
        accept = true;
      }

      if (accept) {
        const acceptData = encodeFunctionData({
          abi: OpenTaskMarketABI,
          functionName: "acceptCounterOffer",
          args: [taskId],
        });
        await safeSubmit(this.publicClient, this.walletClient, {
          to: CONTRACTS.OpenTaskMarket,
          data: acceptData,
        });
        console.log(`[CounterOffer] ✅ Accepted counter-offer for task #${taskId} (price: ${formatEther(counterPrice)} ETH)`);
      } else {
        const rejectData = encodeFunctionData({
          abi: OpenTaskMarketABI,
          functionName: "rejectCounterOffer",
          args: [taskId],
        });
        await safeSubmit(this.publicClient, this.walletClient, {
          to: CONTRACTS.OpenTaskMarket,
          data: rejectData,
        });
        console.log(`[CounterOffer] ❌ Rejected counter-offer for task #${taskId} (too low: ${formatEther(counterPrice)} ETH < 90% of ${formatEther(originalPrice)} ETH)`);
      }
    } catch (error) {
      console.error(`[CounterOffer] Error handling counter-offer for task ${taskId}:`, error);
    }
  }
}

// ============ MAIN FUNCTION ============

async function runBidderDaemon(bidderAgent: BidderAgent): Promise<void> {
  console.log("\n[DAEMON] Starting bidder agent in daemon mode...");
  console.log("[DAEMON] Will check for new tasks every 60 seconds and respond to counter-offers");

  // Initial bidding cycle
  await bidderAgent.checkAndBidOnOpenTasks(3);

  // Set up recurring bidding every 60 seconds
  setInterval(async () => {
    try {
      await bidderAgent.checkAndBidOnOpenTasks(2); // Smaller batch for recurring
    } catch (error) {
      console.error("[DAEMON] Error in periodic bidding:", error);
    }
  }, 60 * 1000);

  // Set up event listener for counter-offers
  try {
    // Use WebSocket if available
    const wsUrl = process.env.BASE_SEPOLIA_RPC_URL?.replace('https', 'wss')?.replace('http', 'ws') || 'wss://sepolia.base.org';
    const eventListener = new EventListener(wsUrl);

    eventListener.subscribe(
      CONTRACTS.OpenTaskMarket,
      OpenTaskMarketABI,
      'CounterOfferMade',
      async (event) => {
        const taskId = event.args.taskId as bigint;
        const bidderAddr = event.args.bidder as string;
        const counterPrice = event.args.counterPrice as bigint;
        const counterTimeEstimate = event.args.counterTimeEstimate as number;
        const counterProposalHash = event.args.counterProposalHash as string;

        console.log(`\n[EVENT] CounterOfferMade: task #${taskId}, price ${formatEther(counterPrice)} ETH`);

        // Let the bidder agent handle it (only if it's our bid)
        await bidderAgent.handleCounterOffer(taskId);
      }
    );

    console.log("[DAEMON] Listening for CounterOfferMade events...");
  } catch (error) {
    console.warn("[DAEMON] Could not start WebSocket listener for counter-offers:", error);
    console.warn("[DAEMON] Counter-offer auto-response will be disabled. Run with WebSocket RPC to enable.");
  }

  console.log("[DAEMON] Bidder daemon is now running. Press Ctrl+C to stop.");

  // Keep process alive
  await new Promise(() => {
    // Intentional infinite promise to keep Node.js event loop active
  });
}

async function main() {
  const { BIDDER_PRIVATE_KEY } = process.env;

  if (!BIDDER_PRIVATE_KEY) {
    console.error("Missing BIDDER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  const bidderAgent = new BidderAgent(BIDDER_PRIVATE_KEY);

  console.log("=== BIDDER AGENT ===");
  console.log(`Address: ${bidderAgent.account.address}`);

  // Check balance
  const balance = await bidderAgent.publicClient.getBalance({ address: bidderAgent.account.address });
  console.log(`Balance: ${formatEther(balance)} ETH`);

  // Determine mode: use --daemon flag, else one-shot
  const args = process.argv.slice(2);
  const isDaemon = args.includes('--daemon') || args.includes('--listen') || args.includes('--events');

  if (isDaemon) {
    await runBidderDaemon(bidderAgent);
  } else {
    console.log("\n[ONE-SHOT] Checking for open tasks to bid on...");
    await bidderAgent.checkAndBidOnOpenTasks(3);
    console.log("\n=== Bidder agent finished ===");
  }
}


main().catch(console.error);