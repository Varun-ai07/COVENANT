import * as dotenv from "dotenv";
import { formatEther, parseEther } from "viem";
import { createWallet, CONTRACTS } from "./lib/config.js";
import { AgentRegistryABI, TaskEscrowABI } from "./lib/abis.js";
import { generateJSON } from "./lib/llm.js";

dotenv.config();

interface TaskMemory {
  taskId: bigint;
  agentAddress: string;
  taskType: string;
  outcome: 'success' | 'failure';
  reward: bigint;
  duration: number; // seconds
  difficulty: number; // 1-10
  timestamp: bigint;
  lessonsLearned: string;
}

/**
 * Memory Agent - Handles persistent agent memory and experience tracking
 */
class MemoryAgent {
  private name: string;
  private capabilities: string[];
  private memory: TaskMemory[] = [];
  private walletClient: any;
  private publicClient: any;
  private account: any;

  constructor() {
    this.name = "MemoryAgent";
    this.capabilities = ["experience-tracking", "lessons-learning", "pattern-recognition"];
  }

  /**
   * Initialize wallet connections
   */
  private async init() {
    const privateKey = process.env.MEMORY_AGENT_PRIVATE_KEY || process.env.CLIENT_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Missing MEMORY_AGENT_PRIVATE_KEY (or CLIENT_PRIVATE_KEY) in .env");
    }
    const { wallet, account, publicClient } = createWallet(privateKey);
    this.walletClient = wallet;
    this.account = account;
    this.publicClient = publicClient;
  }

  /**
   * Main execution loop
   */
  async run() {
    console.log(`🧠  ${this.name} started`);

    await this.init();

    // Register on-chain if not already
    await this.registerIfNeeded();

    // Load historical memory from events
    await this.loadHistoricalMemory();

    // Listen for new task completions to update memory
    this.listenForTaskEvents();

    // Periodically analyze patterns and generate insights
    setInterval(() => this.analyzePatterns(), 1800000); // Every 30 minutes

    // Share insights with other agents periodically
    setInterval(() => this.shareInsights(), 3600000); // Every hour
  }

  /**
   * Register agent on-chain if not already registered
   */
  private async registerIfNeeded() {
    try {
      const isRegistered = await this.publicClient.readContract({
        address: CONTRACTS.AgentRegistry,
        abi: AgentRegistryABI,
        functionName: "isRegistered",
        args: [this.account.address],
      }) as boolean;

      if (!isRegistered) {
        console.log("📝 Registering Memory Agent on-chain...");
        const hash = await this.walletClient.writeContract({
          address: CONTRACTS.AgentRegistry,
          abi: AgentRegistryABI,
          functionName: "register",
          args: [this.name, this.capabilities],
          value: parseEther("0.001"),
        });
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        console.log("✅ Memory Agent registered!");
      }
    } catch (error) {
      console.error("❌ Failed to register memory agent:", error);
    }
  }

  /**
   * Load historical memory from blockchain events
   *
   * Note: Uses getTask polling since TaskEscrow doesn't expose
   * a direct event query API via viem publicClient in this setup.
   * In production, this would use watchContractEvent for TaskCompleted.
   */
  private async loadHistoricalMemory() {
    try {
      console.log("📚 Loading historical task memory...");

      // Try to load recent submitted tasks as a proxy for historical data
      try {
        const submittedTaskIds = await this.publicClient.readContract({
          address: CONTRACTS.TaskEscrow,
          abi: TaskEscrowABI,
          functionName: "getSubmittedTasks",
        }) as bigint[];

        for (const taskId of submittedTaskIds) {
          try {
            const task = await this.publicClient.readContract({
              address: CONTRACTS.TaskEscrow,
              abi: TaskEscrowABI,
              functionName: "getTask",
              args: [taskId],
            }) as any;

            const memory: TaskMemory = {
              taskId,
              agentAddress: task.worker || "0x0",
              taskType: this.inferTaskType(task.descriptionHash || ""),
              outcome: 'success',
              reward: task.payment || 0n,
              duration: 0,
              difficulty: 5,
              timestamp: task.deadline || BigInt(Math.floor(Date.now() / 1000)),
              lessonsLearned: "",
            };

            this.memory.push(memory);
          } catch (err) {
            // Skip tasks that can't be loaded
          }
        }
      } catch (err) {
        console.warn("Could not load submitted tasks:", err);
      }

      console.log(`🧠 Loaded ${this.memory.length} task memories`);

      // Process memories to extract lessons
      if (this.memory.length > 0) {
        await this.processMemoryLessons();
      }
    } catch (error) {
      console.error("❌ Error loading historical memory:", error);
    }
  }

  /**
   * Listen for new task completion events via polling
   *
   * Uses periodic polling since we don't have WebSocket-based
   * event subscription set up in this implementation.
   */
  private listenForTaskEvents() {
    console.log("📝 Memory event listener started (polling mode)");
    // Poll every 30 seconds for new task events
    setInterval(async () => {
      try {
        const submittedTaskIds = await this.publicClient.readContract({
          address: CONTRACTS.TaskEscrow,
          abi: TaskEscrowABI,
          functionName: "getSubmittedTasks",
        }) as bigint[];

        for (const taskId of submittedTaskIds) {
          // Skip if we already have this task in memory
          if (this.memory.some(m => m.taskId === taskId)) continue;

          try {
            const task = await this.publicClient.readContract({
              address: CONTRACTS.TaskEscrow,
              abi: TaskEscrowABI,
              functionName: "getTask",
              args: [taskId],
            }) as any;

            const memory: TaskMemory = {
              taskId,
              agentAddress: task.worker || "0x0",
              taskType: this.inferTaskType(task.descriptionHash || ""),
              outcome: 'success',
              reward: task.payment || 0n,
              duration: 0,
              difficulty: 5,
              timestamp: task.deadline || BigInt(Math.floor(Date.now() / 1000)),
              lessonsLearned: "",
            };

            this.memory.push(memory);
            console.log(`🧠 Added new memory for task ${taskId}`);

            await this.analyzeSingleMemory(memory);
          } catch (err) {
            // Skip tasks that can't be loaded
          }
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 30000);
  }

  /**
   * Infer task type from description hash (simplified)
   */
  private inferTaskType(descriptionHash: string): string {
    // In a real implementation, we would look up the actual description from IPFS
    // For now, we'll use a simple hash-based classification
    if (!descriptionHash || descriptionHash.length < 8) return "general";
    const hashNum = parseInt(descriptionHash.substring(0, 8), 16);
    const types = [
      "data-analysis", "content-generation", "code-review",
      "image-processing", "research", "translation",
      "social-media", "financial-modeling", "legal-review"
    ];
    return types[hashNum % types.length];
  }

  /**
   * Estimate task difficulty based on task properties
   */
  private estimateTaskDifficulty(task: any): number {
    // Base difficulty on payment amount and time constraints
    const paymentFactor = Math.min(Number(task.payment || 0n) / 0.01e18, 5); // Normalize to 0.01 ETH
    const timeFactor = (task.deadline || 0n) - (task.createdAt || 0n) > 86400n ? 2 : 1; // Longer tasks = harder

    return Math.min(Math.floor((paymentFactor + timeFactor) / 2 * 2), 10); // 1-10 scale
  }

  /**
   * Process all memories to extract lessons learned
   */
  private async processMemoryLessons() {
    console.log("🎓 Processing memories for lessons learned...");

    for (const memory of this.memory) {
      if (!memory.lessonsLearned) {
        await this.analyzeSingleMemory(memory);
      }
    }

    console.log("✅ Memory processing complete");
  }

  /**
   * Analyze a single memory to extract lessons
   */
  private async analyzeSingleMemory(memory: TaskMemory) {
    try {
      const analysisPrompt = `
        You are an AI agent analyzing your own past performance to improve future work.

        Task Memory:
        - Task Type: ${memory.taskType}
        - Outcome: ${memory.outcome}
        - Reward: ${formatEther(memory.reward)} ETH
        - Duration: ${memory.duration} seconds
        - Difficulty: ${memory.difficulty}/10
        - Timestamp: ${new Date(Number(memory.timestamp) * 1000).toISOString()}

        Based on this experience, what lessons should you learn to improve future performance?
        Consider:
        1. What went well (if successful) or what went wrong (if failed)?
        2. How could you approach similar tasks differently?
        3. What skills or knowledge would help you perform better?
        4. What warnings or recommendations would you give to your future self?

        Provide your lessons as a concise string (1-2 sentences).
      `;

      const lessons = await generateJSON(analysisPrompt);
      memory.lessonsLearned = typeof lessons === 'string' ? lessons.trim() : JSON.stringify(lessons);

      console.log(`💡 Lesson learned for task ${memory.taskId}: ${memory.lessonsLearned}`);
    } catch (error) {
      console.error("❌ Error analyzing memory:", error);
      memory.lessonsLearned = "Analysis failed - manual review needed";
    }
  }

  /**
   * Analyze patterns across all memories to generate insights
   */
  private async analyzePatterns() {
    if (this.memory.length < 5) {
      console.log("📊 Not enough data for pattern analysis yet");
      return;
    }

    console.log("📈 Analyzing patterns in agent memory...");

    // Group by task type
    const byType: Record<string, TaskMemory[]> = {};
    for (const memory of this.memory) {
      if (!byType[memory.taskType]) {
        byType[memory.taskType] = [];
      }
      byType[memory.taskType].push(memory);
    }

    // Analyze each type
    const insights: string[] = [];
    for (const [type, memories] of Object.entries(byType)) {
      if (memories.length >= 3) {
        const successRate = memories.filter(m => m.outcome === 'success').length / memories.length;
        const avgReward = memories.reduce((sum, m) => sum + Number(m.reward), 0) / memories.length;
        const avgDuration = memories.reduce((sum, m) => sum + m.duration, 0) / memories.length;
        const avgDifficulty = memories.reduce((sum, m) => sum + m.difficulty, 0) / memories.length;

        let insight = `${type}: `;
        if (successRate >= 0.8) {
          insight += `Strong performance (${(successRate*100).toFixed(0)}% success)`;
        } else if (successRate >= 0.6) {
          insight += `Moderate performance (${(successRate*100).toFixed(0)}% success)`;
        } else {
          insight += `Needs improvement (${(successRate*100).toFixed(0)}% success)`;
        }

        insight += `, Avg reward: ${formatEther(BigInt(Math.floor(avgReward)))} ETH`;
        insight += `, Avg duration: ${Math.floor(avgDuration/60)}m ${Math.floor(avgDuration%60)}s`;
        insight += `, Avg difficulty: ${avgDifficulty.toFixed(1)}/10`;

        insights.push(insight);
      }
    }

    // Generate overall insights
    const overallPrompt = `
      You are an AI agent analyzing your performance across different task types.

      Performance Insights:
      ${insights.join('\n')}

      Based on this data, what are your top 3 recommendations for improving your overall performance as an agent?
      Consider:
      1. Which task types should you focus on or avoid?
      2. What skills should you develop?
      3. How should you adjust your bidding or task selection strategy?

      Provide your recommendations as a numbered list.
    `;

    try {
      const recommendations = await generateJSON(overallPrompt);
      console.log("📋 Performance Recommendations:");
      console.log(typeof recommendations === 'string' ? recommendations : JSON.stringify(recommendations, null, 2));
    } catch (error) {
      console.error("❌ Error generating performance insights:", error);
    }
  }

  /**
   * Share insights with other agents (simplified)
   */
  private async shareInsights() {
    if (this.memory.length === 0) return;

    try {
      // Generate a summary of key insights
      const successfulTasks = this.memory.filter(m => m.outcome === 'success');
      const failedTasks = this.memory.filter(m => m.outcome === 'failure');

      const successRate = successfulTasks.length / this.memory.length;
      const avgReward = successfulTasks.length > 0
        ? successfulTasks.reduce((sum, m) => sum + Number(m.reward), 0) / successfulTasks.length
        : 0;

      const insightSummary = `
        MemoryAgent Performance Summary:
        - Total Tasks: ${this.memory.length}
        - Success Rate: ${(successRate*100).toFixed(1)}%
        - Average Reward: ${formatEther(BigInt(Math.floor(avgReward)))} ETH
        - Key Strengths: ${this.identifyStrengths()}
        - Areas for Improvement: ${this.identifyWeaknesses()}
      `;

      console.log("🤝 Sharing insights with agent community:");
      console.log(insightSummary);

      // In a real implementation, we might post this to a shared knowledge base
      // or send it directly to other agents via encrypted messaging
    } catch (error) {
      console.error("❌ Error sharing insights:", error);
    }
  }

  /**
   * Identify strengths based on memory analysis
   */
  private identifyStrengths(): string {
    if (this.memory.length === 0) return "Insufficient data";

    // Find task types with highest success rates
    const typeSuccess: Record<string, { success: number; total: number }> = {};
    for (const memory of this.memory) {
      if (!typeSuccess[memory.taskType]) {
        typeSuccess[memory.taskType] = { success: 0, total: 0 };
      }
      typeSuccess[memory.taskType].total++;
      if (memory.outcome === 'success') {
        typeSuccess[memory.taskType].success++;
      }
    }

    let bestType = "";
    let bestRate = 0;
    for (const [type, stats] of Object.entries(typeSuccess)) {
      if (stats.total >= 3) { // Only consider types with sufficient data
        const rate = stats.success / stats.total;
        if (rate > bestRate) {
          bestRate = rate;
          bestType = type;
        }
      }
    }

    return bestType || "Insufficient data for strength identification";
  }

  /**
   * Identify weaknesses based on memory analysis
   */
  private identifyWeaknesses(): string {
    if (this.memory.length === 0) return "Insufficient data";

    // Find task types with lowest success rates
    const typeSuccess: Record<string, { success: number; total: number }> = {};
    for (const memory of this.memory) {
      if (!typeSuccess[memory.taskType]) {
        typeSuccess[memory.taskType] = { success: 0, total: 0 };
      }
      typeSuccess[memory.taskType].total++;
      if (memory.outcome === 'success') {
        typeSuccess[memory.taskType].success++;
      }
    }

    let worstType = "";
    let worstRate = 1;
    for (const [type, stats] of Object.entries(typeSuccess)) {
      if (stats.total >= 3) { // Only consider types with sufficient data
        const rate = stats.success / stats.total;
        if (rate < worstRate) {
          worstRate = rate;
          worstType = type;
        }
      }
    }

    return worstType || "Insufficient data for weakness identification";
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const total = this.memory.length;
    const successful = this.memory.filter(m => m.outcome === 'success').length;
    const failed = this.memory.filter(m => m.outcome === 'failure').length;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const avgReward = successful > 0
      ? this.memory.filter(m => m.outcome === 'success').reduce((sum, m) => sum + Number(m.reward), 0) / successful
      : 0;

    return {
      totalMemories: total,
      successfulTasks: successful,
      failedTasks: failed,
      successRate: successRate.toFixed(1),
      averageReward: formatEther(BigInt(Math.floor(avgReward))),
      taskTypes: [...new Set(this.memory.map(m => m.taskType))].length
    };
  }
}

// Start the memory agent
const memoryAgent = new MemoryAgent();
memoryAgent.run().catch(console.error);

export default memoryAgent;
