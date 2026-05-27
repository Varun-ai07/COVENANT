import type { Address, PublicClient, WalletClient, Hash, Chain, Account } from "viem";
import { getContractAddresses, CHAIN_CONFIGS } from "./config.js";
import { AgentRegistryABI } from "./contracts/AgentRegistry.js";
import { TaskEscrowABI } from "./contracts/TaskEscrow.js";
import { OpenTaskMarketABI } from "./contracts/OpenTaskMarket.js";
import type {
  CovenantConfig,
  AgentData,
  TaskData,
  TaskStatus,
  ContractAddresses,
} from "./types.js";

// Re-export types
export * from "./types.js";
export * from "./config.js";

/**
 * COVENANT SDK - TypeScript client for the Autonomous Agent Enforcement Protocol
 *
 * @example
 * ```typescript
 * import { CovenantSDK, createPublicClient, http } from "@covenant/sdk";
 * import { baseSepolia } from "viem/chains";
 *
 * const client = createPublicClient({ chain: baseSepolia, transport: http() });
 * const sdk = new CovenantSDK({ chainId: 84532, publicClient: client });
 *
 * const agent = await sdk.getAgent("0x...");
 * const agents = await sdk.findAgents("data-analysis");
 * ```
 */
export class CovenantSDK {
  protected publicClient: PublicClient;
  protected walletClient?: WalletClient;
  private addresses: ContractAddresses;
  protected chain: Chain;
  protected account?: Account;

  constructor(config: CovenantConfig) {
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
    this.account = config.walletClient?.account;
    this.addresses = getContractAddresses(config.chainId, config.contractAddresses);
    this.chain = CHAIN_CONFIGS[config.chainId as keyof typeof CHAIN_CONFIGS]?.chain ?? {
      id: config.chainId,
      name: `Chain ${config.chainId}`,
      nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [] } },
    };
  }

  // =========================================================================
  // Agent Methods
  // =========================================================================

  /**
   * Get agent data by address
   */
  async getAgent(address: Address): Promise<AgentData> {
    const result = await this.publicClient.readContract({
      address: this.addresses.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgent",
      args: [address],
    });
    return this.parseAgentData(result as readonly unknown[]);
  }

  /**
   * Get total number of registered agents
   */
  async getAgentCount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.addresses.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgentCount",
      args: [],
    }) as bigint;
  }

  /**
   * Find agents by capability
   */
  async findAgents(capability: string, minReputation?: number, limit = 20): Promise<Address[]> {
    const addresses = await this.publicClient.readContract({
      address: this.addresses.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAgentsByCapability",
      args: [capability, BigInt(0), BigInt(limit)],
    }) as Address[];

    if (minReputation !== undefined) {
      // Filter by reputation
      const filtered: Address[] = [];
      for (const addr of addresses) {
        const agent = await this.getAgent(addr);
        if (agent.reputation >= BigInt(minReputation)) {
          filtered.push(addr);
        }
      }
      return filtered;
    }

    return addresses;
  }

  /**
   * Get all agents with pagination
   */
  async getAllAgents(offset = 0, limit = 50): Promise<Address[]> {
    return await this.publicClient.readContract({
      address: this.addresses.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "getAllAgents",
      args: [BigInt(offset), BigInt(limit)],
    }) as Address[];
  }

  /**
   * Register a new agent (requires wallet)
   */
  async registerAgent(
    name: string,
    capabilities: string[],
    stake: bigint
  ): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.AgentRegistry,
      abi: AgentRegistryABI,
      functionName: "register",
      args: [name, capabilities],
      value: stake,
      chain: this.chain,
      account: this.account!,
    });
  }

  // =========================================================================
  // Task Methods
  // =========================================================================

  /**
   * Get task data by ID
   */
  async getTask(taskId: bigint): Promise<TaskData> {
    const result = await this.publicClient.readContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getTask",
      args: [taskId],
    });
    return this.parseTaskData(result as readonly unknown[]);
  }

  /**
   * Get total number of tasks
   */
  async getTaskCount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getTaskCount",
      args: [],
    }) as bigint;
  }

  /**
   * Get all task IDs for a client
   */
  async getClientTasks(client: Address): Promise<bigint[]> {
    return await this.publicClient.readContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getClientTasks",
      args: [client],
    }) as bigint[];
  }

  /**
   * Get all task IDs for a worker
   */
  async getWorkerTasks(worker: Address): Promise<bigint[]> {
    return await this.publicClient.readContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "getWorkerTasks",
      args: [worker],
    }) as bigint[];
  }

  /**
   * Create a new task (requires wallet)
   */
  async createTask(
    worker: Address,
    payment: bigint,
    deadline: bigint,
    descriptionHash: string
  ): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "createTask",
      args: [worker, deadline, descriptionHash],
      value: payment,
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Submit work for a task (requires wallet)
   */
  async submitWork(taskId: bigint, deliverableHash: string): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "submitWork",
      args: [taskId, deliverableHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Verify task completion (requires wallet)
   */
  async verifyTask(taskId: bigint, success: boolean): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "verifyTask",
      args: [taskId, success],
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Dispute a task (requires wallet)
   */
  async disputeTask(taskId: bigint, disputeBond: bigint): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.TaskEscrow,
      abi: TaskEscrowABI,
      functionName: "disputeTask",
      args: [taskId],
      value: disputeBond,
      chain: this.chain,
      account: this.account!,
    });
  }

  // =========================================================================
  // Open Task Market Methods
  // =========================================================================

  /**
   * Post an open task for bidding
   */
  async postOpenTask(
    maxPayment: bigint,
    deadline: bigint,
    descriptionHash: string
  ): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.OpenTaskMarket,
      abi: OpenTaskMarketABI,
      functionName: "postOpenTask",
      args: [maxPayment, deadline, descriptionHash],
      value: maxPayment,
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Submit a bid on an open task
   */
  async submitBid(
    taskId: bigint,
    price: bigint,
    timeEstimate: bigint,
    proposalHash: string
  ): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.OpenTaskMarket,
      abi: OpenTaskMarketABI,
      functionName: "submitBid",
      args: [taskId, price, timeEstimate, proposalHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  /**
   * Select a worker for an open task
   */
  async selectWorker(taskId: bigint, worker: Address): Promise<Hash> {
    this.requireWallet();

    return await this.walletClient!.writeContract({
      address: this.addresses.OpenTaskMarket,
      abi: OpenTaskMarketABI,
      functionName: "selectWorker",
      args: [taskId, worker],
      chain: this.chain,
      account: this.account!,
    });
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Wait for a transaction to be confirmed
   */
  async waitForTransaction(hash: Hash) {
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }

  /**
   * Get contract addresses being used
   */
  getAddresses(): ContractAddresses {
    return { ...this.addresses };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  protected requireWallet(): void {
    if (!this.walletClient) {
      throw new Error("Wallet client required for write operations. Pass walletClient in config.");
    }
  }

  private parseAgentData(result: readonly unknown[]): AgentData {
    return {
      did: result[0] as `0x${string}`,
      name: result[1] as string,
      capabilities: result[2] as string[],
      reputation: result[3] as bigint,
      stakedAmount: result[4] as bigint,
      tasksCompleted: result[5] as bigint,
      tasksFailed: result[6] as bigint,
      totalValueTransferred: result[7] as bigint,
      isActive: result[8] as boolean,
      registeredAt: result[9] as bigint,
      walletAddress: result[10] as Address,
    };
  }

  private parseTaskData(result: readonly unknown[]): TaskData {
    const statusMap: TaskStatus[] = ["Open", "Funded", "InProgress", "Submitted", "Completed", "Disputed", "Failed", "Cancelled"];
    return {
      taskId: result[0] as bigint,
      client: result[1] as Address,
      worker: result[2] as Address,
      payment: result[3] as bigint,
      deadline: result[4] as bigint,
      descriptionHash: result[5] as string,
      deliverableHash: result[6] as string,
      status: statusMap[result[7] as number] || "Open",
      createdAt: result[8] as bigint,
      completedAt: result[9] as bigint,
      protocolFee: result[10] as bigint,
      totalValue: result[11] as bigint,
    };
  }
}
