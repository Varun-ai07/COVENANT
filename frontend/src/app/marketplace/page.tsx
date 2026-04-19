"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { getContractAddresses } from "@/contracts/addresses";
import { useTaskCounter, useCreateTask, useWatchTasks } from "@/hooks/useTask";
import { useAgentsByCapability } from "@/hooks/useAgent";
import { TaskCard } from "@/components/TaskCard";
import { TaskStatus } from "@/types";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { useToast } from "@/components/Toast";

type StatusFilter = "all" | TaskStatus;
type TabView = "tasks" | "workers";

export default function MarketplacePage() {
  const { isConnected, chain } = useAccount();
  const [activeTab, setActiveTab] = useState<TabView>("tasks");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [workerAddress, setWorkerAddress] = useState("");
  const [payment, setPayment] = useState("0.01");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [searchCapability, setSearchCapability] = useState("data-analysis");

  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);
  const taskCount = useTaskCounter();
  const { createTask, isPending, isConfirming, isSuccess, hash, error } = useCreateTask();
  const { addresses: workerAddresses, isLoading: workersLoading } = useAgentsByCapability(searchCapability);
  const { addToast } = useToast();

  useWatchTasks((taskId) => {
    addToast({ type: "info", title: "New Task Created", message: `Task #${taskId} is now available` });
  });

  useEffect(() => {
    if (isSuccess && hash) {
      addToast({ type: "success", title: "Task Created", message: "Your task has been created and funded!", txHash: hash });
      setShowCreateForm(false);
      setWorkerAddress("");
      setDescription("");
    }
  }, [isSuccess, hash]);

  useEffect(() => {
    if (error) {
      const msg = error.message?.includes("User rejected") ? "Transaction rejected by user" : error.message?.slice(0, 100);
      addToast({ type: "error", title: "Task Creation Failed", message: msg });
    }
  }, [error]);

  const handleCreateTask = async () => {
    if (!workerAddress || !payment || !deadline || !description) return;
    const deadlineMs = new Date(deadline).getTime();
    const nowMs = Date.now();

    if (!Number.isFinite(deadlineMs)) {
      addToast({ type: "error", title: "Invalid deadline", message: "Please choose a valid deadline." });
      return;
    }

    if (deadlineMs <= nowMs) {
      addToast({ type: "error", title: "Invalid deadline", message: "Deadline must be in the future." });
      return;
    }

    const paymentNum = Number(payment);
    if (!Number.isFinite(paymentNum) || paymentNum <= 0) {
      addToast({ type: "error", title: "Invalid payment", message: "Payment must be a positive ETH amount." });
      return;
    }

    const deadlineTimestamp = BigInt(Math.floor(deadlineMs / 1000));
    const descriptionPayload = {
      title: description.slice(0, 80),
      description,
      createdAt: new Date().toISOString(),
      source: "marketplace.create-task",
    };

    let descriptionHash: string;
    try {
      const response = await fetch("/api/ipfs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: descriptionPayload }),
      });

      if (!response.ok) {
        throw new Error("Failed to store task description");
      }

      const data = (await response.json()) as { hash: string };
      descriptionHash = data.hash;
    } catch (error) {
      addToast({
        type: "error",
        title: "IPFS Storage Failed",
        message: error instanceof Error ? error.message : "Failed to persist task description",
      });
      return;
    }

    createTask(workerAddress as `0x${string}`, payment, deadlineTimestamp, descriptionHash);
  };

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: "all", label: "All Tasks" },
    { value: TaskStatus.InProgress, label: "In Progress" },
    { value: TaskStatus.Submitted, label: "Submitted" },
    { value: TaskStatus.Completed, label: "Completed" },
    { value: TaskStatus.Failed, label: "Failed" },
  ];

  const capabilities = ["data-analysis", "content-generation", "code-review", "task-creation"];

  return (
    <div>
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-silkscreen text-2xl text-white mb-2 tracking-[0.15em]">MARKETPLACE</h1>
          <p className="text-white/40 text-sm">Discover tasks and find skilled agents</p>
        </div>
        {isConnected && (
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 flex items-center gap-2"
          >
            {showCreateForm ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Task
              </>
            )}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 bg-white/5 p-1 rounded-xl w-fit backdrop-blur-sm border border-white/5">
        <button
          onClick={() => setActiveTab("tasks")}
          className={`relative px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === "tasks" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeTab === "tasks" && (
            <div className="absolute inset-0 bg-violet-500/20 rounded-lg border border-violet-500/30" />
          )}
          <span className="relative z-10 flex items-center gap-2 font-silkscreen text-[10px] tracking-[0.1em]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            BROWSE TASKS
          </span>
        </button>
        <button
          onClick={() => setActiveTab("workers")}
          className={`relative px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === "workers" ? "text-white" : "text-slate-400 hover:text-white"
          }`}
        >
          {activeTab === "workers" && (
            <div className="absolute inset-0 bg-violet-500/20 rounded-lg border border-violet-500/30" />
          )}
          <span className="relative z-10 flex items-center gap-2 font-silkscreen text-[10px] tracking-[0.1em]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            DISCOVER WORKERS
          </span>
        </button>
      </div>

      {/* Create Task Form */}
      {showCreateForm && isConnected && (
        <div className="glass-card p-6 mb-8 animate-fade-in-up">
          <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-silkscreen text-xs tracking-[0.1em]">CREATE NEW TASK</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-slate-400 text-sm mb-2">Worker Address</label>
              <input
                type="text"
                value={workerAddress}
                onChange={(e) => setWorkerAddress(e.target.value)}
                placeholder="0x..."
                className="input-glass w-full"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Payment (ETH)</label>
              <input
                type="text"
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                placeholder="0.01"
                className="input-glass w-full"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Deadline</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="input-glass w-full"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-2">Task Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Analyze sales data for Q1 2024..."
                className="input-glass w-full"
              />
            </div>
          </div>

          <button
            onClick={handleCreateTask}
            disabled={!workerAddress || !payment || !deadline || !description || isPending || isConfirming}
            className="mt-6 w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 disabled:opacity-50 font-silkscreen text-xs tracking-[0.1em]"
          >
            {isPending ? "CONFIRM IN WALLET..." : isConfirming ? "CREATING ON-CHAIN..." : "CREATE & FUND TASK"}
          </button>

          {hash && (
            <div className="mt-4 p-4 bg-black/20 rounded-xl border border-white/5">
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
      )}

      {activeTab === "tasks" && (
        <>
          {/* Status Filters */}
          <div className="flex flex-wrap gap-2 mb-8">
            {statusFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  statusFilter === filter.value
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                    : "bg-white/5 text-slate-400 hover:text-white border border-white/5 hover:border-white/10"
                }`}
              >
                <span className="font-silkscreen text-[10px] tracking-[0.1em]">{filter.label.toUpperCase()}</span>
              </button>
            ))}
          </div>

          {/* Task List */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="font-silkscreen text-xs tracking-[0.1em]">TASKS</span>
            </h2>
            <span className="text-slate-500 text-sm">{taskCount} total</span>
          </div>

          {taskCount === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-slate-400">No tasks yet</p>
              <p className="text-slate-600 text-sm mt-1">Create the first one!</p>
            </div>
          ) : (
            <div className="grid gap-4 stagger-children">
              {Array.from({ length: taskCount }, (_, i) => taskCount - i)
                .slice(0, 20)
                .map((taskId) => (
                  <TaskCard key={taskId} taskId={BigInt(taskId)} contracts={contracts} />
                ))}
            </div>
          )}
        </>
      )}

      {activeTab === "workers" && (
        <>
          {/* Capability Search */}
          <div className="mb-8">
            <label className="block text-slate-400 text-sm mb-3 font-silkscreen tracking-[0.1em]">SEARCH BY CAPABILITY</label>
            <div className="flex flex-wrap gap-2">
              {capabilities.map((cap) => (
                <button
                  key={cap}
                  onClick={() => setSearchCapability(cap)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    searchCapability === cap
                      ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                      : "bg-white/5 text-slate-400 hover:text-white border border-white/5 hover:border-white/10"
                  }`}
                >
                  <span className="font-silkscreen text-[10px] tracking-[0.1em]">{cap.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Worker List */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="font-silkscreen text-xs tracking-[0.1em]">WORKERS</span>
            </h2>
            <span className="text-slate-500 text-sm">{workerAddresses.length} found</span>
          </div>

          {workersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-6 shimmer">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-xl" />
                    <div className="flex-1">
                      <div className="h-4 bg-white/5 rounded w-1/3 mb-2" />
                      <div className="h-3 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : workerAddresses.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <p className="text-slate-400">No workers found with this capability</p>
            </div>
          ) : (
            <div className="space-y-4 stagger-children">
              {workerAddresses.map((address) => (
                <WorkerCard
                  key={address}
                  address={address}
                  contracts={contracts}
                  onSelect={(addr) => {
                    setWorkerAddress(addr);
                    setShowCreateForm(true);
                    setActiveTab("tasks");
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WorkerCard({
  address,
  contracts,
  onSelect,
}: {
  address: `0x${string}`;
  contracts: ReturnType<typeof getContractAddresses>;
  onSelect: (address: string) => void;
}) {
  const { data: agentData } = useReadContract({
    address: contracts.AgentRegistry as `0x${string}`,
    abi: AgentRegistryABI,
    functionName: "getAgent",
    args: [address],
  });

  if (!agentData) return null;

  const agent = agentData as {
    name: string;
    reputation: bigint;
    capabilities: string[];
    tasksCompleted: bigint;
    isActive: boolean;
  };

  if (!agent.isActive) return null;

  return (
    <div className="glass-card card-inner-glow p-5">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl blur-sm opacity-30" />
            <div className="relative w-12 h-12 bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 rounded-xl flex items-center justify-center">
              <span className="text-violet-400 font-bold text-lg">{agent.name?.[0]?.toUpperCase()}</span>
            </div>
          </div>
          <div>
            <p className="text-white font-medium">{agent.name}</p>
            <p className="text-slate-500 text-sm font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-slate-500 text-xs">Reputation</p>
            <p className="text-white font-semibold">{agent.reputation.toString()}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500 text-xs">Tasks Done</p>
            <p className="text-white font-semibold">{agent.tasksCompleted.toString()}</p>
          </div>
          <button
            onClick={() => onSelect(address)}
            className="px-5 py-2.5 bg-violet-500/20 text-violet-300 text-sm font-medium rounded-xl hover:bg-violet-500/30 transition-colors border border-violet-500/30"
          >
            <span className="font-silkscreen text-[10px] tracking-[0.1em]">HIRE</span>
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {agent.capabilities?.map((cap: string, i: number) => (
          <span key={i} className="px-2.5 py-1 bg-white/5 text-slate-400 text-xs rounded-lg border border-white/5">
            {cap}
          </span>
        ))}
      </div>
    </div>
  );
}
