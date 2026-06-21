import type { Address, PublicClient, WalletClient, Hash, Chain, Account } from "viem";
import { getContractAddresses, CHAIN_CONFIGS } from "./config.js";
import { CovenantIdentityABI } from "./contracts/CovenantIdentity.js";
import { CovenantEscrowABI } from "./contracts/CovenantEscrow.js";
import type {
  CovenantConfig,
  AgentData,
  TaskData,
  TaskStatus,
  ContractAddresses,
} from "./types.js";

export * from "./types.js";
export * from "./config.js";
export { CovenantSDKV5 } from "./v5-extensions.js";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as Address;

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
  // Agent Methods (V5 — CovenantIdentity)
  // =========================================================================

  async getAgent(address: Address): Promise<AgentData> {
    const result = await this.publicClient.readContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "getAgent",
      args: [address],
    });
    return this.parseAgentData(address, result as readonly unknown[]);
  }

  async getAgentCount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "totalAgents",
      args: [],
    }) as bigint;
  }

  async isRegistered(address: Address): Promise<boolean> {
    return await this.publicClient.readContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "isRegistered",
      args: [address],
    }) as boolean;
  }

  async findAgents(capability: string, minReputation?: number, limit = 20): Promise<Address[]> {
    const count = await this.getAgentCount();
    const results: Address[] = [];
    const capHash = BigInt(
      "0x" + Array.from(new TextEncoder().encode(capability))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
    ).toString();

    for (let i = 0n; i < count && results.length < limit; i++) {
      try {
        const agentAddr = await this.publicClient.readContract({
          address: this.addresses.CovenantIdentity,
          abi: CovenantIdentityABI,
          functionName: "getAllAgents",
          args: [i, 1n],
        }) as Address;
        if (agentAddr === ZERO_ADDR) continue;
        const hasCap = await this.publicClient.readContract({
          address: this.addresses.CovenantIdentity,
          abi: CovenantIdentityABI,
          functionName: "hasCapability",
          args: [agentAddr, `0x${capHash.padStart(64, "0")}`],
        }) as boolean;
        if (!hasCap) continue;
        if (minReputation !== undefined) {
          const agent = await this.getAgent(agentAddr);
          if (agent.reputation < BigInt(minReputation)) continue;
        }
        results.push(agentAddr);
      } catch {
        continue;
      }
    }
    return results;
  }

  async getAllAgents(offset = 0, limit = 50): Promise<Address[]> {
    const count = await this.getAgentCount();
    const results: Address[] = [];
    for (let i = BigInt(offset); i < count && results.length < limit; i++) {
      try {
        const addr = await this.publicClient.readContract({
          address: this.addresses.CovenantIdentity,
          abi: CovenantIdentityABI,
          functionName: "getAllAgents",
          args: [i, 1n],
        }) as Address;
        if (addr !== ZERO_ADDR) results.push(addr);
      } catch {
        continue;
      }
    }
    return results;
  }

  async registerAgent(stake: bigint, metadataRoot: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI,
      functionName: "register",
      args: [stake, metadataRoot],
      value: stake,
      chain: this.chain,
      account: this.account!,
    });
  }

  // =========================================================================
  // Task Methods (V5 — CovenantEscrow)
  // =========================================================================

  async getTask(taskId: bigint): Promise<TaskData> {
    const result = await this.publicClient.readContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "getTask",
      args: [taskId],
    });
    return this.parseTaskData(taskId, result as readonly unknown[]);
  }

  async getTaskCount(): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "taskCount",
      args: [],
    }) as bigint;
  }

  async createTask(
    worker: Address,
    amount: bigint,
    deadline: number,
    metaHash: `0x${string}`,
  ): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "createTask",
      args: [worker, amount, deadline, metaHash],
      value: amount,
      chain: this.chain,
      account: this.account!,
    });
  }

  async submitWork(taskId: bigint, deliverableHash: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "submitWork",
      args: [taskId, deliverableHash],
      chain: this.chain,
      account: this.account!,
    });
  }

  async completeTask(taskId: bigint, clientSignature: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "completeTask",
      args: [taskId, clientSignature],
      chain: this.chain,
      account: this.account!,
    });
  }

  async disputeTask(taskId: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "disputeTask",
      args: [taskId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async cancelTask(taskId: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "cancelTask",
      args: [taskId],
      chain: this.chain,
      account: this.account!,
    });
  }

  async fundTask(taskId: bigint, amount: bigint): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "fundTask",
      args: [taskId],
      value: amount,
      chain: this.chain,
      account: this.account!,
    });
  }

  async failTask(taskId: bigint, reason: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return await this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI,
      functionName: "failTask",
      args: [taskId, reason],
      chain: this.chain,
      account: this.account!,
    });
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  async waitForTransaction(hash: Hash) {
    return await this.publicClient.waitForTransactionReceipt({ hash });
  }

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

  private parseAgentData(address: Address, result: readonly unknown[]): AgentData {
    return {
      did: address,
      name: "",
      capabilities: [],
      reputation: BigInt(result[2] as number),
      stakedAmount: result[1] as bigint,
      tasksCompleted: 0n,
      tasksFailed: 0n,
      totalValueTransferred: 0n,
      isActive: result[5] as boolean,
      registeredAt: BigInt(result[3] as number),
      walletAddress: result[0] as Address,
    };
  }

  private parseTaskData(taskId: bigint, result: readonly unknown[]): TaskData {
    return {
      taskId,
      client: result[0] as Address,
      worker: result[1] as Address,
      payment: result[2] as bigint,
      deadline: BigInt(result[3] as number),
      descriptionHash: result[6] as string,
      deliverableHash: "",
      status: this.mapV5Status(result[4] as number),
      createdAt: 0n,
      completedAt: 0n,
      protocolFee: 0n,
      totalValue: result[2] as bigint,
    };
  }

  private mapV5Status(status: number): TaskStatus {
    const map: Record<number, TaskStatus> = {
      0: "Open",
      1: "Funded",
      2: "InProgress",
      3: "Submitted",
      4: "Completed",
      5: "Disputed",
      6: "Failed",
      7: "Cancelled",
    };
    return map[status] ?? "Open";
  }
}
