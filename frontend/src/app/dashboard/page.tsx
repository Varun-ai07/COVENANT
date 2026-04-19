"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { formatEther, parseEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { useAgent, useAgentCount } from "@/hooks/useAgent";
import { useClientTasks, useWorkerTasks } from "@/hooks/useTask";
import { TaskCard } from "@/components/TaskCard";
import { getReputationLevel } from "@/types";
import { useToast } from "@/components/Toast";

type Tab = "profile" | "client" | "worker" | "verifier";

const SUPPORTED_CHAIN_IDS = [31337, 84532];

export default function DashboardPage() {
  const { address, isConnected, chain } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const isWrongNetwork = isConnected && chain?.id !== undefined && !SUPPORTED_CHAIN_IDS.includes(chain.id);
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [name, setName] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [stakeAmount, setStakeAmount] = useState("0.001");

  const { agent, isLoading: agentLoading, refetch: refetchAgent, isRegistered } = useAgent();
  const agentCount = useAgentCount();
  const { taskIds: clientTaskIds, refetch: refetchClientTasks } = useClientTasks(address);
  const { taskIds: workerTaskIds, refetch: refetchWorkerTasks } = useWorkerTasks(address);
  const { addToast } = useToast();

  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({ hash });

  const handleRegister = () => {
    if (!name || !capabilities) return;
    const capsArray = capabilities.split(",").map((c) => c.trim()).filter(Boolean);
    writeContract({
      address: contracts.AgentRegistry as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "register",
      args: [name, capsArray],
      value: parseEther(stakeAmount),
      gas: BigInt(300000),
    });
  };

  const handleAddStake = () => {
    writeContract({
      address: contracts.AgentRegistry as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "addStake",
      value: parseEther("0.001"),
      gas: BigInt(100000),
    });
  };

  useEffect(() => {
    if (isSuccess) {
      refetchAgent();
      refetchClientTasks();
      refetchWorkerTasks();
      addToast({
        type: "success",
        title: "Transaction Confirmed",
        message: "Your action was successful!",
        txHash: hash,
      });
      reset();
    }
  }, [isSuccess, hash, refetchAgent, refetchClientTasks, refetchWorkerTasks, addToast, reset]);

  useEffect(() => {
    if (writeError) {
      const message = writeError.message?.includes("User rejected")
        ? "Transaction rejected by user"
        : writeError.message?.slice(0, 100) || "Transaction failed";
      addToast({
        type: "error",
        title: "Transaction Failed",
        message,
      });
    }
  }, [writeError, addToast]);

  useEffect(() => {
    if (txError) {
      addToast({
        type: "error",
        title: "Transaction Failed",
        message: txError.message?.slice(0, 100) || "Transaction reverted",
      });
    }
  }, [txError, addToast]);

  const reputationLevel = agent ? getReputationLevel(Number(agent.reputation)) : null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "profile", label: "My Profile" },
    { id: "client", label: "Client Tasks", count: clientTaskIds.length },
    { id: "worker", label: "Worker Tasks", count: workerTaskIds.length },
    { id: "verifier", label: "Verifier" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-silkscreen text-2xl text-white mb-2 tracking-[0.15em]">DASHBOARD</h1>
        <p className="text-white/40 text-sm">Manage your agent profile and track your tasks</p>
      </div>

      {isWrongNetwork && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/5 border border-red-500/20 backdrop-blur-sm">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-red-400 font-semibold text-sm">Wrong Network</p>
                <p className="text-slate-500 text-xs">
                  Connected to {chain?.name || "Unknown"} (Chain ID: {chain?.id}). Switch to Base Sepolia.
                </p>
              </div>
            </div>
            <button
              onClick={() => switchChain({ chainId: 84532 })}
              disabled={isSwitching}
              className="px-4 py-2 bg-blue-500/20 text-blue-400 text-sm font-medium rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50 border border-blue-500/20 font-silkscreen text-[10px] tracking-[0.1em]"
            >
              {isSwitching ? "SWITCHING..." : "SWITCH NETWORK"}
            </button>
          </div>
        </div>
      )}

      {isConnected && !isWrongNetwork && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="status-dot status-dot-online" />
            <div>
              <p className="text-emerald-400 font-semibold text-sm">
                {chain?.id === 84532 ? "Connected to Base Sepolia" : "Connected to Localhost"}
              </p>
              <p className="text-slate-500 text-xs">
                {chain?.id === 84532
                  ? "You're on Base Sepolia testnet. Get testnet ETH from the Coinbase faucet."
                  : "Hardhat node running. You have 10,000 ETH for testing."}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isConnected ? (
        <div className="space-y-6">
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-slate-400 mb-2">Connect your wallet to view your agent profile</p>
            <p className="text-slate-600 text-sm">Use the Connect button in the navigation bar</p>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Local Development Setup
            </h3>
            <div className="space-y-4">
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="text-slate-400 text-sm mb-3">Add Hardhat Network to MetaMask</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-slate-500">Network Name</div>
                  <div className="text-violet-400 font-mono">Hardhat Local</div>
                  <div className="text-slate-500">RPC URL</div>
                  <div className="text-violet-400 font-mono">http://127.0.0.1:8545</div>
                  <div className="text-slate-500">Chain ID</div>
                  <div className="text-violet-400 font-mono">31337</div>
                  <div className="text-slate-500">Currency</div>
                  <div className="text-violet-400 font-mono">ETH</div>
                </div>
              </div>
              <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                <p className="text-slate-400 text-sm mb-3">Import Test Account (10,000 ETH)</p>
                <div className="space-y-2 text-xs font-mono break-all">
                  <div>
                    <span className="text-slate-500">Address: </span>
                    <span className="text-violet-400">0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Key: </span>
                    <span className="text-violet-400">0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-8 bg-white/5 p-1 rounded-xl w-fit backdrop-blur-sm border border-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {activeTab === tab.id && (
                  <div className="absolute inset-0 bg-violet-500/20 rounded-lg border border-violet-500/30" />
                )}
                <span className="relative z-10 flex items-center gap-2 font-silkscreen text-[10px] tracking-[0.1em]">
                  {tab.label.toUpperCase()}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="px-1.5 py-0.5 bg-white/10 text-xs rounded-md">{tab.count}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {activeTab === "profile" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-silkscreen text-xs tracking-[0.1em]">AGENT PROFILE</span>
                </h2>

                {agentLoading ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white/5 rounded-2xl shimmer" />
                      <div className="space-y-2 flex-1">
                        <div className="h-4 bg-white/5 rounded w-1/2 shimmer" />
                        <div className="h-3 bg-white/5 rounded w-1/3 shimmer" />
                      </div>
                    </div>
                    <div className="h-20 bg-white/5 rounded-xl shimmer" />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="h-16 bg-white/5 rounded-xl shimmer" />
                      <div className="h-16 bg-white/5 rounded-xl shimmer" />
                    </div>
                  </div>
                ) : isRegistered ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl blur-md opacity-40" />
                        <div className="relative w-14 h-14 bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-2xl flex items-center justify-center">
                          <span className="text-violet-400 font-bold text-xl">{agent?.name?.[0]}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-lg">{agent?.name}</p>
                        <p className="text-slate-500 text-sm font-mono">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </p>
                      </div>
                    </div>

                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                      <p className="text-slate-500 text-xs mb-1">DID (ERC-8004)</p>
                      <p className="text-slate-300 text-sm font-mono truncate">{agent?.did}</p>
                    </div>

                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-400 text-sm">Reputation</span>
                        <span className={`font-semibold text-sm ${reputationLevel?.color}`}>
                          {agent?.reputation?.toString()}/1000 ({reputationLevel?.label})
                        </span>
                      </div>
                      <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${reputationLevel?.bgColor}`}
                          style={{ width: `${(Number(agent?.reputation) / 1000) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <p className="text-slate-500 text-xs mb-1">Staked</p>
                        <p className="text-white font-semibold">{formatEther(agent?.stakedAmount || BigInt(0))} ETH</p>
                      </div>
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <p className="text-slate-500 text-xs mb-1">Tasks Done</p>
                        <p className="text-white font-semibold">{agent?.tasksCompleted?.toString()}</p>
                      </div>
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <p className="text-slate-500 text-xs mb-1">Tasks Failed</p>
                        <p className="text-red-400 font-semibold">{agent?.tasksFailed?.toString()}</p>
                      </div>
                      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <p className="text-slate-500 text-xs mb-1">Total Value</p>
                        <p className="text-white font-semibold">{formatEther(agent?.totalValueTransferred || BigInt(0))} ETH</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-500 text-xs mb-2">Capabilities</p>
                      <div className="flex flex-wrap gap-2">
                        {agent?.capabilities?.map((cap: string, i: number) => (
                          <span
                            key={i}
                            className="px-3 py-1.5 bg-violet-500/10 text-violet-300 text-xs rounded-lg border border-violet-500/20"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleAddStake}
                      disabled={isPending || isConfirming}
                      className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all duration-200 disabled:opacity-50 text-sm font-medium font-silkscreen text-[10px] tracking-[0.1em]"
                    >
                      {isPending ? "CONFIRM IN WALLET..." : isConfirming ? "ADDING STAKE..." : "ADD 0.001 ETH STAKE"}
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                      <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 mb-2">You are not registered as an agent yet</p>
                    <p className="text-slate-600 text-sm">Complete the registration form to get started</p>
                  </div>
                )}
              </div>

              {!isRegistered ? (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span className="font-silkscreen text-xs tracking-[0.1em]">REGISTER AS AGENT</span>
                  </h2>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-slate-400 text-sm mb-2">Agent Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., DataAnalyzer"
                        className="input-glass w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 text-sm mb-2">Capabilities (comma-separated)</label>
                      <input
                        type="text"
                        value={capabilities}
                        onChange={(e) => setCapabilities(e.target.value)}
                        placeholder="e.g., data-analysis, content-writing, code-review"
                        className="input-glass w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 text-sm mb-2">Stake Amount (ETH)</label>
                      <input
                        type="text"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                        placeholder="0.01"
                        className="input-glass w-full"
                      />
                      <p className="text-slate-600 text-xs mt-1.5">Minimum: 0.001 ETH</p>
                    </div>

                    <button
                      onClick={handleRegister}
                      disabled={!name || !capabilities || isPending || isConfirming || isWrongNetwork}
                      className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-silkscreen text-xs tracking-[0.1em]"
                    >
                      {isWrongNetwork
                        ? "SWITCH NETWORK FIRST"
                        : isPending
                        ? "CONFIRM IN WALLET..."
                        : isConfirming
                        ? "REGISTERING ON-CHAIN..."
                        : "REGISTER AGENT"}
                    </button>

                    {hash && (
                      <div className="p-4 bg-black/20 rounded-xl border border-white/5">
                        <p className="text-slate-500 text-xs mb-1">Transaction Hash</p>
                        <a
                          href={`https://sepolia.basescan.org/tx/${hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-violet-400 text-xs font-mono hover:underline break-all"
                        >
                          {hash}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="font-silkscreen text-xs tracking-[0.1em]">NETWORK STATS</span>
                  </h2>
                  <div className="space-y-4">
                    {[
                      { label: "Total Agents", value: agentCount },
                      { label: "My Client Tasks", value: clientTaskIds.length },
                      { label: "My Worker Tasks", value: workerTaskIds.length },
                      { label: "Network", value: chain?.name || "Not Connected" },
                      { label: "Chain ID", value: chain?.id || "-" },
                    ].map((stat, i) => (
                      <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                        <span className="text-slate-400 text-sm">{stat.label}</span>
                        <span className="text-white font-medium text-sm">{stat.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "client" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="font-silkscreen text-xs tracking-[0.1em]">TASKS I CREATED</span>
                </h2>
                <span className="text-slate-500 text-sm">{clientTaskIds.length} total</span>
              </div>
              {clientTaskIds.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-slate-400">You haven&apos;t created any tasks yet</p>
                  <p className="text-slate-600 text-sm mt-1">Visit the Marketplace to create your first task</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {clientTaskIds.map((taskId) => (
                    <TaskCard key={taskId.toString()} taskId={taskId} contracts={contracts} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "worker" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="font-silkscreen text-xs tracking-[0.1em]">TASKS ASSIGNED TO ME</span>
                </h2>
                <span className="text-slate-500 text-sm">{workerTaskIds.length} total</span>
              </div>
              {workerTaskIds.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                    <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-400">No tasks assigned to you yet</p>
                  <p className="text-slate-600 text-sm mt-1">Make sure your capabilities match what clients are looking for</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {workerTaskIds.map((taskId) => (
                    <TaskCard key={taskId.toString()} taskId={taskId} contracts={contracts} highlight />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "verifier" && (
            <div className="glass-card p-8 text-center">
              <h3 className="text-lg font-semibold text-white mb-2">Verifier Workspace</h3>
              <p className="text-slate-400 mb-6">
                Open the dedicated verifier module to validate submitted work, manage verifier actions, and monitor verification flow.
              </p>
              <Link
                href="/verifier"
                className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 font-silkscreen text-xs tracking-[0.1em]"
              >
                OPEN VERIFIER MODULE
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
