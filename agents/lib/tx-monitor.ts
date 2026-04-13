// TX Hash Monitor for Demo
// Captures transaction hashes during demo execution

import { createPublicClient, http, type PublicClient } from 'viem';
import { baseSepolia, foundry } from 'viem/chains';
import fs from 'fs';

interface TXRecord {
  step: number;
  txHash: string;
  stepName: string;
  agent: string;
  timestamp: string;
  gasUsed?: string;
  explorerUrl?: string;
}

class TXMonitor {
  private client: PublicClient;
  private records: TXRecord[] = [];
  private chain: typeof baseSepolia;

  constructor(contractAddress: string, rpcUrl: string, network: 'localhost' | 'sepolia' = 'sepolia') {
    this.chain = network === 'localhost' ? foundry : baseSepolia;
    this.client = createPublicClient({
      chain: this.chain,
      transport: http(rpcUrl),
    });
  }

  async captureStep(step: number, stepName: string, agent: string, txHash: string): Promise<void> {
    const record: TXRecord = {
      step,
      stepName,
      agent,
      txHash,
      timestamp: new Date().toISOString(),
    };

    try {
      // Get transaction info
      const receipt = await this.client.getTransactionReceipt({ hash: txHash as `0x${string}` });
      record.gasUsed = receipt.gasUsed.toString();
    } catch (e) {
      // Receipt not available yet
    }

    // Generate explorer URL
    if (this.chain.id === 84532) { // Base Sepolia
      record.explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;
    } else {
      record.explorerUrl = `http://localhost:8545/tx/${txHash}`;
    }

    this.records.push(record);
    
    // Save immediately
    this.saveToFile();
    
    console.log(`\n✓ TX captured [Step ${step}]: ${stepName}`);
    console.log(`  Hash: ${txHash}`);
    if (record.explorerUrl) {
      console.log(`  Explorer: ${record.explorerUrl}`);
    }
  }

  saveToFile(): void {
    const output = {
      demoRun: new Date().toISOString(),
      network: this.chain.name,
      transactions: this.records,
    };
    
    fs.writeFileSync('.demo-tx-hashes.json', JSON.stringify(output, null, 2));
  }

  getRecords(): TXRecord[] {
    return this.records;
  }

  clear(): void {
    this.records = [];
    if (fs.existsSync('.demo-tx-hashes.json')) {
      fs.unlinkSync('.demo-tx-hashes.json');
    }
  }
}

export default TXMonitor;
export type { TXRecord };
