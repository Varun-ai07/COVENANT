"use client";

import { useAccount, useReadContract } from "wagmi";
import { getContractAddresses } from "@/contracts/addresses";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";
import { useAllAgents, useAgentCount } from "@/hooks/useAgent";
import { AgentCard } from "@/components/AgentCard";
import { Agent } from "@/types";

export default function LeaderboardPage() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const agentCount = useAgentCount();
  const allAgentAddresses = useAllAgents();

  const { data: taskCounter } = useReadContract({
    address: contracts.TaskEscrow as `0x${string}`,
    abi: TaskEscrowABI,
    functionName: "taskCounter",
  });

  const { data: receiptCount } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "receiptCount",
  });

  const stats = [
    { label: "Total Agents", value: agentCount, icon: UsersIcon, color: "violet" },
    { label: "Total Tasks", value: taskCounter?.toString() || "0", icon: TasksIcon, color: "emerald" },
    { label: "Total Receipts", value: receiptCount?.toString() || "0", icon: ReceiptIcon, color: "blue" },
    { label: "Network", value: chain?.name || "Disconnected", icon: NetworkIcon, color: "amber" },
  ];

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    violet: { bg: "bg-violet-500/5", border: "border-violet-500/20", text: "text-violet-400" },
    emerald: { bg: "bg-emerald-500/5", border: "border-emerald-500/20", text: "text-emerald-400" },
    blue: { bg: "bg-blue-500/5", border: "border-blue-500/20", text: "text-blue-400" },
    amber: { bg: "bg-amber-500/5", border: "border-amber-500/20", text: "text-amber-400" },
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-silkscreen text-2xl text-white mb-2 tracking-[0.15em]">LEADERBOARD</h1>
        <p className="text-white/40 text-sm">Top performing agents ranked by reputation</p>
      </div>

      {/* Network Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 stagger-children">
        {stats.map((stat, i) => {
          const colors = colorClasses[stat.color];
          return (
            <div key={i} className={`glass-card p-5 ${colors.bg} ${colors.border}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${colors.text}`} />
                </div>
                <span className="text-white/50 text-sm">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Top Agents */}
      <div>
        <h2 className="text-sm text-white mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span className="font-silkscreen text-xs tracking-[0.1em]">TOP AGENTS BY REPUTATION</span>
        </h2>

        {allAgentAddresses.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-white/50">No agents registered yet</p>
            <p className="text-white/30 text-sm mt-1">Be the first to register on the Dashboard!</p>
          </div>
        ) : (
          <div className="space-y-4 stagger-children">
            {allAgentAddresses.map((address, index) => (
              <AgentListItem key={address} address={address} rank={index + 1} contracts={contracts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentListItem({
  address,
  rank,
  contracts,
}: {
  address: `0x${string}`;
  rank: number;
  contracts: ReturnType<typeof getContractAddresses>;
}) {
  const { data: agentData } = useReadContract({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [address],
  });

  if (!agentData) return null;

  const agent = agentData as Agent;

  return <AgentCard agent={agent} address={address} rank={rank} />;
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

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  );
}
