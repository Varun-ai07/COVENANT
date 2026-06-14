import { type Address, type PublicClient, type WalletClient, keccak256, toBytes } from "viem";

export interface DelegatedCapability {
  agent: Address;
  capabilityHash: `0x${string}`;
  expiry: number;
  valueLimit: bigint;
  revoked: boolean;
  grantedAt: number;
}

export interface CapabilityConfig {
  identityAddress: Address;
  identityAbi: any;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export class CapabilityManager {
  public identityAddress: Address;
  public identityAbi: any;

  private capabilities: Map<string, DelegatedCapability> = new Map();
  private publicClient: PublicClient;
  private walletClient: WalletClient;

  static CAPABILITY_TYPES = {
    CREATE_TASK: keccak256(toBytes("create_task")),
    SUBMIT_WORK: keccak256(toBytes("submit_work")),
    MANAGE_ESCROW: keccak256(toBytes("manage_escrow")),
    ARBITRATE: keccak256(toBytes("arbitrate")),
    ATTEST: keccak256(toBytes("attest")),
  };

  constructor(config: CapabilityConfig) {
    this.identityAddress = config.identityAddress;
    this.identityAbi = config.identityAbi;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;
  }

  grantCapability(
    agent: Address,
    capabilityHash: `0x${string}`,
    expiry: number,
    valueLimit: bigint
  ): string {
    const key = `${agent}:${capabilityHash}`;
    this.capabilities.set(key, {
      agent,
      capabilityHash,
      expiry,
      valueLimit,
      revoked: false,
      grantedAt: Math.floor(Date.now() / 1000),
    });
    return key;
  }

  revokeCapability(agent: Address, capabilityHash: `0x${string}`): void {
    const key = `${agent}:${capabilityHash}`;
    const cap = this.capabilities.get(key);
    if (cap) {
      cap.revoked = true;
    }
  }

  hasCapability(agent: Address, capabilityHash: `0x${string}`): boolean {
    const key = `${agent}:${capabilityHash}`;
    const cap = this.capabilities.get(key);
    if (!cap || cap.revoked) return false;
    return Date.now() / 1000 < cap.expiry;
  }

  getCapabilities(agent: Address): DelegatedCapability[] {
    return Array.from(this.capabilities.values())
      .filter(c => c.agent === agent);
  }

  getActiveCapabilities(agent: Address): DelegatedCapability[] {
    return this.getCapabilities(agent).filter(c =>
      !c.revoked && Date.now() / 1000 < c.expiry
    );
  }
}
