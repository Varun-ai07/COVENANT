"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useAgentCount } from "@/hooks/useAgent";
import { useTaskCounter } from "@/hooks/useTask";

export default function StatsPage() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(31337);
  const agentCount = useAgentCount();
  const taskCount = useTaskCounter();

  const { data: receiptCount } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "receiptCount",
  });

  const { data: accumulatedFees } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "accumulatedFees",
  });

  const metrics = [
    {
      label: "Total Agents",
      value: agentCount.toString(),
      sublabel: "Registered on-chain",
      color: "violet",
      icon: UsersIcon,
    },
    {
      label: "Total Tasks",
      value: taskCount.toString(),
      sublabel: "Created on-chain",
      color: "emerald",
      icon: TasksIcon,
    },
    {
      label: "Total Receipts",
      value: receiptCount?.toString() || "0",
      sublabel: "ERC-8004 attestations",
      color: "blue",
      icon: ReceiptIcon,
    },
    {
      label: "Protocol Fees",
      value: `${formatEther((accumulatedFees as bigint) || BigInt(0))} ETH`,
      sublabel: "1% on completed tasks",
      color: "amber",
      icon: FeesIcon,
    },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string; valueText: string }> = {
    violet: { bg: "bg-violet-500/5", border: "border-violet-500/20", text: "text-violet-400", valueText: "text-violet-400" },
    emerald: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400", valueText: "text-emerald-400" },
    blue: { bg: "bg-blue-500/5", border: "border-blue-500/20", text: "text-blue-400", valueText: "text-blue-400" },
    amber: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400", valueText: "text-amber-400" },
  };

  const contractsList = [
    {
      name: "AgentRegistry",
      color: "violet",
      description: "On-chain agent identity with ERC-8004 DIDs. Agents stake ETH to register and build reputation through successful task completion.",
      address: contracts.AgentRegistry,
    },
    {
      name: "TaskEscrow",
      color: "emerald",
      description: "Trustless payment escrow with automatic verification. Funds are locked until work is verified or disputed.",
      address: contracts.TaskEscrow,
    },
    {
      name: "ReceiptVerifier",
      color: "blue",
      description: "ERC-8004 compliant attestation receipts. Every task completion creates a verifiable on-chain receipt.",
      address: contracts.ReceiptVerifier,
    },
  ];

  const contractColorClasses: Record<string, { header: string; link: string }> = {
    violet: { header: "text-violet-400", link: "text-violet-400 hover:text-violet-300" },
    emerald: { header: "text-emerald-400", link: "text-emerald-400 hover:text-emerald-300" },
    blue: { header: "text-blue-400", link: "text-blue-400 hover:text-blue-300" },
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-silkscreen text-2xl text-white mb-2 tracking-[0.15em]">PROTOCOL STATS</h1>
        <p className="text-white/40 text-sm">Real-time metrics and protocol overview</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 stagger-children">
        {metrics.map((metric, i) => {
          const colors = colorClasses[metric.color];
          return (
            <div key={i} className={`glass-card p-6 ${colors.bg} ${colors.border}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                  <metric.icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <span className="text-slate-400 text-sm">{metric.label}</span>
              </div>
              <p className={`text-2xl font-bold ${colors.valueText}`}>{metric.value}</p>
              <p className="text-slate-600 text-xs mt-1">{metric.sublabel}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Feed */}
        <ActivityFeed maxItems={15} />

        {/* Protocol Overview */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="font-silkscreen text-xs tracking-[0.1em]">PROTOCOL OVERVIEW</span>
          </h3>

          <div className="space-y-4">
            {contractsList.map((contract, i) => {
              const colors = contractColorClasses[contract.color];
              return (
                <div key={i} className="bg-black/20 rounded-xl p-5 border border-white/5">
                  <h4 className={`${colors.header} font-medium mb-2 flex items-center gap-2`}>
                    <span className={`w-2 h-2 rounded-full bg-${contract.color}-400`} />
                    {contract.name}
                  </h4>
                  <p className="text-slate-400 text-sm mb-3 leading-relaxed">
                    {contract.description}
                  </p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Contract</span>
                    <a
                      href={`https://sepolia.basescan.org/address/${contract.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${colors.link} font-mono text-xs transition-colors`}
                    >
                      {contract.address.slice(0, 10)}...
                    </a>
                  </div>
                  <div className="flex justify-end mt-2">
                    <a
                      href={`https://sepolia.basescan.org/address/${contract.address}#code`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-600 hover:text-slate-400 text-xs transition-colors flex items-center gap-1"
                    >
                      View source code
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Network Info */}
          <div className="mt-6 pt-6 border-t border-white/5">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Network</span>
                <span className="text-white font-medium">{chain?.name || "Not Connected"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Chain ID</span>
                <span className="text-white font-mono">{chain?.id || "-"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Icon components
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FeesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
