/**
 * Self-contained CovenantSDK for MCP — no external @covenant/sdk dependency.
 * Implements only the methods that MCP tools actually call.
 */
import type { Address, PublicClient, WalletClient, Hash, Chain, Account } from "viem";
import { baseSepolia } from "viem/chains";

// V5 ABIs
import CovenantIdentityABI from "./abis/CovenantIdentity.json" with { type: "json" };
import CovenantEscrowABI from "./abis/CovenantEscrow.json" with { type: "json" };

import type { ContractAddresses, AgentData, TaskData, CovenantConfig } from "./shared-types.js";

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
    this.addresses = config.contractAddresses as ContractAddresses;
    this.chain = baseSepolia;
  }

  protected requireWallet(): void {
    if (!this.walletClient) throw new Error("Wallet required");
  }

  // ── Agent Methods (V5 CovenantIdentity) ──

  async getAgent(address: Address): Promise<AgentData> {
    const r = await this.publicClient.readContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI.abi,
      functionName: "getAgent",
      args: [address],
    });
    const d = r as any;
    return {
      did: address, name: "", capabilities: [],
      reputation: BigInt(d.reputation ?? d[2] ?? 0),
      stakedAmount: BigInt(d.stake ?? d[1] ?? 0),
      tasksCompleted: 0n, tasksFailed: 0n, totalValueTransferred: 0n,
      isActive: d.active ?? d[5] ?? false,
      registeredAt: BigInt(d.registeredAt ?? d[3] ?? 0),
      walletAddress: d.owner ?? d[0] ?? ZERO_ADDR,
    };
  }

  async getAgentCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI.abi,
      functionName: "totalAgents", args: [],
    }) as Promise<bigint>;
  }

  async isRegistered(address: Address): Promise<boolean> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI.abi,
      functionName: "isRegistered", args: [address],
    }) as Promise<boolean>;
  }

  async findAgents(capability: string, minReputation?: number, limit = 20): Promise<Address[]> {
    const count = await this.getAgentCount();
    const results: Address[] = [];
    for (let i = 0n; i < count && results.length < limit; i++) {
      try {
        const addr = await this.publicClient.readContract({
          address: this.addresses.CovenantIdentity,
          abi: CovenantIdentityABI.abi,
          functionName: "getAllAgents", args: [i, 1n],
        }) as Address;
        if (addr === ZERO_ADDR) continue;
        if (minReputation !== undefined) {
          const agent = await this.getAgent(addr);
          if (agent.reputation < BigInt(minReputation)) continue;
        }
        results.push(addr);
      } catch { continue; }
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
          abi: CovenantIdentityABI.abi,
          functionName: "getAllAgents", args: [i, 1n],
        }) as Address;
        if (addr !== ZERO_ADDR) results.push(addr);
      } catch { continue; }
    }
    return results;
  }

  async registerAgent(stake: bigint, metadataRoot: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantIdentity,
      abi: CovenantIdentityABI.abi,
      functionName: "register", args: [stake, metadataRoot],
      value: stake, chain: this.chain, account: this.account!,
    });
  }

  // ── Task Methods (V5 CovenantEscrow) ──

  async getTask(taskId: bigint): Promise<TaskData> {
    const r = await this.publicClient.readContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI.abi,
      functionName: "getTask", args: [taskId],
    }) as any;
    return {
      taskId, client: r.client ?? r[0], worker: r.worker ?? r[1],
      payment: r.amount ?? r[2], deadline: BigInt(r.deadline ?? r[3] ?? 0),
      descriptionHash: "", deliverableHash: "",
      status: String(r.status ?? r[4] ?? 0),
      createdAt: 0n, completedAt: 0n, protocolFee: 0n, totalValue: r.amount ?? r[2],
    };
  }

  async getTaskCount(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI.abi,
      functionName: "taskCount", args: [],
    }) as Promise<bigint>;
  }

  async createTask(worker: Address, amount: bigint, deadline: number, metaHash: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI.abi,
      functionName: "createTask", args: [worker, amount, deadline, metaHash],
      value: amount, chain: this.chain, account: this.account!,
    });
  }

  async submitWork(taskId: bigint, deliverableHash: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI.abi,
      functionName: "submitWork", args: [taskId, deliverableHash],
      chain: this.chain, account: this.account!,
    });
  }

  async completeTask(taskId: bigint, clientSignature: `0x${string}`): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI.abi,
      functionName: "completeTask", args: [taskId, clientSignature],
      chain: this.chain, account: this.account!,
    });
  }

  async disputeTask(taskId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI.abi,
      functionName: "disputeTask", args: [taskId],
      chain: this.chain, account: this.account!,
    });
  }

  async cancelTask(taskId: bigint): Promise<Hash> {
    this.requireWallet();
    return this.walletClient!.writeContract({
      address: this.addresses.CovenantEscrow,
      abi: CovenantEscrowABI.abi,
      functionName: "cancelTask", args: [taskId],
      chain: this.chain, account: this.account!,
    });
  }

  async waitForTransaction(hash: Hash) {
    return this.publicClient.waitForTransactionReceipt({ hash });
  }
}
