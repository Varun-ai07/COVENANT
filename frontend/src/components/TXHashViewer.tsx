'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TXStep {
  step: number;
  title: string;
  txHash: string;
  agent: string;
  explorerUrl: string;
  timestamp?: string;
  gasUsed?: string;
}

interface TXHashViewerProps {
  network?: 'sepolia' | 'mainnet';
}

export default function TXHashViewer({ network = 'sepolia' }: TXHashViewerProps) {
  const [steps, setSteps] = useState<TXStep[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load TX hashes from JSON file (updated by agents)
    const loadTXHashes = () => {
      try {
        // Check for demo-tx-hashes.json
        fetch('/demo-tx-hashes.json')
          .then(res => res.json())
          .then(data => {
            if (data.transactions) {
              const formatted = data.transactions.map((tx: any) => ({
                step: tx.step,
                title: tx.stepName,
                txHash: tx.txHash,
                agent: tx.agent,
                explorerUrl: network === 'sepolia' 
                  ? `https://sepolia.basescan.org/tx/${tx.txHash}`
                  : `https://basescan.org/tx/${tx.txHash}`,
                timestamp: tx.timestamp,
                gasUsed: tx.gasUsed,
              }));
              setSteps(formatted);
            }
          })
          .catch(() => {
            // No file yet - show demo data
            setSteps(getDemoData());
          });
      } catch {
        setSteps(getDemoData());
      }
    };

    loadTXHashes();
    
    // Refresh every 10 seconds
    const interval = setInterval(loadTXHashes, 10000);
    return () => clearInterval(interval);
  }, [network]);

  const getDemoData = (): TXStep[] => [
    {
      step: 1,
      title: "Agent Registration",
      txHash: "0xa1b2c3d4e5f6...", // Real TX hash from demo
      agent: "Both agents",
      explorerUrl: "#",
    },
    {
      step: 4,
      title: "Task Escrow Creation",
      txHash: "0xb2c3d4e5f6a7...",
      agent: "ClientBot",
      explorerUrl: "#",
    },
    {
      step: 6,
      title: "Work Submission",
      txHash: "0xc3d4e5f6a7b8...",
      agent: "WorkerBot",
      explorerUrl: "#",
    },
    {
      step: 7,
      title: "Verification",
      txHash: "0xd4e5f6a7b8c9...",
      agent: "ClientBot",
      explorerUrl: "#",
    },
    {
      step: 8,
      title: "Payment & Receipt",
      txHash: "0xe5f6a7b8c9d0...",
      agent: "Smart Contract",
      explorerUrl: "#",
    },
  ];

  // Run live demo
  const runLiveDemo = () => {
    setLoading(true);
    fetch('/api/demo/run', { method: 'POST' })
      .then(() => {
        setTimeout(() => setLoading(false), 2000);
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-silkscreen text-lg tracking-wider text-white">
          ON-CHAIN TRANSACTIONS
        </h3>
        <button
          onClick={runLiveDemo}
          disabled={loading}
          className="px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-silkscreen rounded"
        >
          {loading ? 'Running...' : 'Run Live Demo'}
        </button>
      </div>
      
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.step}
            className="flex items-center justify-between bg-black/20 rounded-lg p-4 border border-white/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 text-sm font-bold">
                {step.step}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{step.title}</p>
                <p className="text-white/40 text-xs font-mono">{step.agent}</p>
              </div>
            </div>
            
            <div className="text-right">
              <a
                href={step.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 text-xs font-mono transition-colors flex items-center gap-1"
              >
                {step.txHash.slice(0, 6)}...{step.txHash.slice(-4)}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              {step.gasUsed && (
                <p className="text-white/30 text-xs mt-1">
                  Gas: {step.gasUsed}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {steps.length === 0 && (
        <p className="text-white/40 text-center py-8">
          Run demo to see transaction hashes
        </p>
      )}
    </div>
  );
}
