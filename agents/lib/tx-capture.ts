/**
 * TX Hash Capture Utility
 * Captures transaction hashes from agent stdout and saves to JSON
 */

import * as fs from "fs";
import * as path from "path";

interface TXRecord {
  step: number;
  stepName: string;
  agent: string;
  txHash: string;
  timestamp: string;
  explorerUrl: string;
}

interface DemoTXData {
  demoRun: string;
  network: string;
  transactions: TXRecord[];
}

const TX_FILE = path.join(process.cwd(), "..", "demo-tx-hashes.json");

class TXCapture {
  private transactions: TXRecord[] = [];
  
  capture(step: number, stepName: string, agent: string, txHash: string) {
    const tx: TXRecord = {
      step,
      stepName,
      agent,
      txHash,
      timestamp: new Date().toISOString(),
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
    };
    
    this.transactions.push(tx);
    this.save();
    
    console.log(`\n[TX CAPTURED] Step ${step}: ${stepName}`);
    console.log(`  Hash: ${txHash}`);
    console.log(`  Explorer: ${tx.explorerUrl}\n`);
  }
  
  save() {
    const data: DemoTXData = {
      demoRun: new Date().toISOString(),
      network: "baseSepolia",
      transactions: this.transactions,
    };
    
    fs.writeFileSync(TX_FILE, JSON.stringify(data, null, 2));
    console.log(`[TX FILE UPDATED] ${TX_FILE}`);
  }
  
  getAll(): TXRecord[] {
    return this.transactions;
  }
  
  clear() {
    this.transactions = [];
    if (fs.existsSync(TX_FILE)) {
      fs.unlinkSync(TX_FILE);
    }
  }
}

// Singleton instance
export const txCapture = new TXCapture();
export default TXCapture;
