import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { AgentRegistry__factory } from "../frontend/src/contracts/AgentRegistry";
import { TaskEscrow__factory } from "../frontend/src/contracts/TaskEscrow";
import { config } from "./lib/config";
import { llmGenerate } from "./lib/llm";
import { tracker } from "./lib/tracker";

dotenv.config();

const provider = new ethers.JsonRpcProvider(config.rpcUrl);
const wallet = new ethers.Wallet(process.env.MEMORY_AGENT_PRIVATE_KEY!, provider);
const agentRegistry = AgentRegistry__factory.connect(
  config.contracts.AgentRegistry,
  wallet
);
const taskEscrow = TaskEscrow__factory.connect(
  config.contracts.TaskEscrow,
  wallet
);

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

  constructor() {
    this.name = "MemoryAgent";
    this.capabilities = ["experience-tracking", "lessons-learning", "pattern-recognition"];
  }

  /**
   * Main execution loop
   */
  async run() {
    console.log(`🧠  ${this.name} started`);
    
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
      const isRegistered = await agentRegistry.isRegistered(wallet.address);
      if (!isRegistered) {
        console.log("📝 Registering Memory Agent on-chain...");
        const tx = await agentRegistry.register(
          this.name,
          this.capabilities,
          { value: ethers.parseEther("0.001") }
        );
        await tx.wait();
        console.log("✅ Memory Agent registered!");
        tracker.recordRegistration();
      }
    } catch (error) {
      console.error("❌ Failed to register memory agent:", error);
    }
  }

  /**
   * Load historical memory from blockchain events
   */
  private async loadHistoricalMemory() {
    try {
      console.log("📚 Loading historical task memory...");
      
      // Get all task completed events from TaskEscrow
      const filter = taskEscrow.filters.TaskCompleted(null, null);
      const events = await taskEscrow.queryFilter(filter, 0); // From block 0
      
      for (const event of events) {
        const taskId = event.args.taskId;
        const worker = event.args.worker;
        const workerPayment = event.args.workerPayment;
        
        // Get task details to determine type and outcome
        const task = await taskEscrow.getTask(taskId);
        
        // Determine outcome based on task status
        const outcome = task.status === 4 /* Completed */ ? 'success' : 
                      task.status === 5 /* Failed */ ? 'failure' : 'unknown';
        
        // Create memory entry
        const memory: TaskMemory = {
          taskId,
          agentAddress: worker,
          taskType: this.inferTaskType(task.descriptionHash),
          outcome,
          reward: workerPayment,
          duration: Number(task.completedAt - task.createdAt),
          difficulty: this.estimateTaskDifficulty(task),
          timestamp: task.completedAt || task.createdAt,
          lessonsLearned: "" // Will be filled in by LLM analysis
        };
        
        this.memory.push(memory);
      }
      
      console.log(`🧠 Loaded ${this.memory.length} task memories`);
      
      // Process memories to extract lessons
      await this.processMemoryLessons();
    } catch (error) {
      console.error("❌ Error loading historical memory:", error);
    }
  }

  /**
   * Listen for new task completion events
   */
  private listenForTaskEvents() {
    taskEscrow.on("TaskCompleted", async (taskId, worker, workerPayment) => {
      console.log(`📝 New task completion detected: ${taskId} by ${worker}`);
      
      try {
        // Get task details
        const task = await taskEscrow.getTask(taskId);
        
        // Determine outcome
        const outcome = task.status === 4 /* Completed */ ? 'success' : 
                      task.status === 5 /* Failed */ ? 'failure' : 'unknown';
        
        // Create memory entry
        const memory: TaskMemory = {
          taskId,
          agentAddress: worker,
          taskType: this.inferTaskType(task.descriptionHash),
          outcome,
          reward: workerPayment,
          duration: Number(task.completedAt - task.createdAt),
          difficulty: this.estimateTaskDifficulty(task),
          timestamp: task.completedAt || task.createdAt,
          lessonsLearned: "" // Will be analyzed later
        };
        
        this.memory.push(memory);
        console.log(`🧠 Added new memory for task ${taskId}`);
        
        // Analyze this specific memory for immediate lessons
        await this.analyzeSingleMemory(memory);
      } catch (error) {
        console.error("❌ Error processing task completion memory:", error);
      }
    });
    
    // Also listen for failed tasks
    taskEscrow.on("TaskFailed", async (taskId, refundAmount) => {
      console.log(`📝 New task failure detected: ${taskId}`);
      
      try {
        // Get task details
        const task = await taskEscrow.getTask(taskId);
        
        // Create memory entry for failure
        const memory: TaskMemory = {
          taskId,
          agentAddress: task.worker,
          taskType: this.inferTaskType(task.descriptionHash),
          outcome: 'failure',
          reward: 0n, // No reward for failed tasks
          duration: Number(task.completedAt - task.createdAt),
          difficulty: this.estimateTaskDifficulty(task),
          timestamp: task.completedAt || task.createdAt,
          lessonsLearned: "" // Will be analyzed later
        };
        
        this.memory.push(memory);
        console.log(`🧠 Added failure memory for task ${taskId}`);
        
        // Analyze this specific memory for immediate lessons
        await this.analyzeSingleMemory(memory);
      } catch (error) {
        console.error("❌ Error processing task failure memory:", error);
      }
    });
  }

  /**
   * Infer task type from description hash (simplified)
   */
  private inferTaskType(descriptionHash: string): string {
    // In a real implementation, we would look up the actual description from IPFS
    // For now, we'll use a simple hash-based classification
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
    const paymentFactor = Math.min(Number(task.payment) / 0.01, 5); // Normalize to 0.01 ETH
    const timeFactor = task.deadline - task.createdAt > 86400 ? 2 : 1; // Longer tasks = harder
    
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
        - Reward: ${ethers.formatEther(memory.reward)} ETH
        - Duration: ${memory.duration} seconds
        - Difficulty: ${memory.difficulty}/10
        - Timestamp: ${new Date(memory.timestamp * 1000).toISOString()}
        
        Based on this experience, what lessons should you learn to improve future performance?
        Consider:
        1. What went well (if successful) or what went wrong (if failed)?
        2. How could you approach similar tasks differently?
        3. What skills or knowledge would help you perform better?
        4. What warnings or recommendations would you give to your future self?
        
        Provide your lessons as a concise string (1-2 sentences).
      `;
      
      const lessons = await llmGenerate(analysisPrompt);
      memory.lessonsLearned = lessons.trim();
      
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
        
        insight += `, Avg reward: ${ethers.formatEther(BigInt(Math.floor(avgReward * 1e18)))} ETH`;
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
      const recommendations = await llmGenerate(overallPrompt);
      console.log("📋 Performance Recommendations:");
      console.log(recommendations);
      
      tracker.recordMemoryInsights(recommendations);
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
      const avgReward = successfulTasks.reduce((sum, m) => sum + Number(m.reward), 0) / successfulTasks.length || 0;
      
      const insightSummary = `
        MemoryAgent Performance Summary:
        - Total Tasks: ${this.memory.length}
        - Success Rate: ${(successRate*100).toFixed(1)}%
        - Average Reward: ${ethers.formatEther(BigInt(Math.floor(avgReward * 1e18)))} ETH
        - Key Strengths: ${this.identifyStrengths()}
        - Areas for Improvement: ${this.identifyWeaknesses()}
      `;
      
      console.log("🤝 Sharing insights with agent community:");
      console.log(insightSummary);
      
      // In a real implementation, we might post this to a shared knowledge base
      // or send it directly to other agents via encrypted messaging
      
      tracker.recordKnowledgeSharing(insightSummary);
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
      averageReward: ethers.formatEther(BigInt(Math.floor(avgReward * 1e18))),
      taskTypes: [...new Set(this.memory.map(m => m.taskType))].length
    };
  }
}

// Start the memory agent
const memoryAgent = new MemoryAgent();
memoryAgent.run().catch(console.error);

export default memoryAgent;