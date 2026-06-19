import { type Address, type PublicClient, type WalletClient, type Hash, keccak256, toBytes, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadStore, saveStore } from "./persistence.js";

export interface SignedReceipt {
  id: string;
  payer: Address;
  payee: Address;
  amount: bigint;
  nonce: bigint;
  timestamp: number;
  payerSignature: `0x${string}`;
  settled: boolean;
}

export interface ReceiptEnvelope {
  payer: Address;
  payee: Address;
  amount: bigint;
  nonce: bigint;
  chainId: number;
}

export interface CoordinatorConfig {
  escrowAddress: Address;
  identityAddress: Address;
  settlementAddress: Address;
  escrowAbi: any;
  identityAbi: any;
  settlementAbi: any;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export class ReceiptEngine {
  public escrowAddress: Address;
  public escrowAbi: any;
  public settlementAddress: Address;
  public settlementAbi: any;

  private receipts: Map<string, SignedReceipt>;
  private nonceCounters: Map<Address, bigint>;
  private publicClient: PublicClient;
  private walletClient: WalletClient;

  static RECEIPT_TYPEHASH = keccak256(
    toBytes("Receipt(address payer,address payee,uint128 amount,uint256 nonce,uint256 chainId)")
  );

  constructor(config: CoordinatorConfig) {
    this.escrowAddress = config.escrowAddress;
    this.escrowAbi = config.escrowAbi;
    this.settlementAddress = config.settlementAddress;
    this.settlementAbi = config.settlementAbi;
    this.publicClient = config.publicClient;
    this.walletClient = config.walletClient;

    // Load from SQLite persistence
    this.receipts = new Map(Object.entries(loadStore("receipts", {})));
    this.nonceCounters = new Map(
      Object.entries(loadStore("nonces", {})).map(([k, v]) => [k as Address, BigInt(v as string)])
    );
  }

  createReceipt(
    payer: Address,
    payee: Address,
    amount: bigint,
    payerSignature: `0x${string}`
  ): string {
    const nonce = this.getNextNonce(payer);
    const receiptId = keccak256(
      encodePacked(
        ["address", "address", "uint128", "uint256"],
        [payer, payee, amount, nonce]
      )
    );

    const receipt: SignedReceipt = {
      id: receiptId,
      payer,
      payee,
      amount,
      nonce,
      timestamp: Math.floor(Date.now() / 1000),
      payerSignature,
      settled: false,
    };

    this.receipts.set(receiptId, receipt);
    this.persist();
    return receiptId;
  }

  getReceipt(receiptId: Hash): SignedReceipt | undefined {
    return this.receipts.get(receiptId);
  }

  getReceiptsByPayer(payer: Address): SignedReceipt[] {
    return Array.from(this.receipts.values()).filter(r => r.payer === payer);
  }

  getReceiptsByPayee(payee: Address): SignedReceipt[] {
    return Array.from(this.receipts.values()).filter(r => r.payee === payee);
  }

  markSettled(receiptId: Hash): void {
    const receipt = this.receipts.get(receiptId);
    if (receipt) {
      receipt.settled = true;
      this.persist();
    }
  }

  private persist(): void {
    const receiptsObj: Record<string, SignedReceipt> = {};
    this.receipts.forEach((v, k) => { receiptsObj[k] = v; });
    saveStore("receipts", receiptsObj);

    const noncesObj: Record<string, string> = {};
    this.nonceCounters.forEach((v, k) => { noncesObj[k] = v.toString(); });
    saveStore("nonces", noncesObj);
  }

  getUnsettledReceipts(): SignedReceipt[] {
    return Array.from(this.receipts.values()).filter(r => !r.settled);
  }

  async buildReceiptEnvelope(
    payer: Address,
    payee: Address,
    amount: bigint
  ): Promise<ReceiptEnvelope> {
    const chainId = await this.publicClient.getChainId();
    return {
      payer,
      payee,
      amount,
      nonce: this.getNextNonce(payer),
      chainId,
    };
  }

  private getNextNonce(address: Address): bigint {
    const current = this.nonceCounters.get(address) ?? 0n;
    this.nonceCounters.set(address, current + 1n);
    return current;
  }
}
