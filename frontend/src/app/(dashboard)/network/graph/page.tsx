"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import { ArrowLeft, RefreshCw, ZoomIn, ZoomOut, GitBranch } from "lucide-react";
import { D3NetworkGraph } from "@/components/network/D3NetworkGraph";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { usePublicClient } from "wagmi";
import { getContractAddresses } from "@/config/contracts";
import { useChainId } from "wagmi";

// Minimal ABI for fetching agents and tasks
const AGENT_REGISTRY_ABI = [
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "agents",
    outputs: [
      { name: "did", type: "bytes32" },
      { name: "walletAddress", type: "address" },
      { name: "name", type: "string" },
      { name: "stakedAmount", type: "uint256" },
      { name: "reputation", type: "int256" },
      { name: "tasksCompleted", type: "uint256" },
      { name: "tasksFailed", type: "uint256" },
      { name: "isActive", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "agentCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const TASK_ESCROW_ABI = [
  {
    inputs: [{ name: "", type: "uint256" }],
    name: "tasks",
    outputs: [
      { name: "client", type: "address" },
      { name: "worker", type: "address" },
      { name: "payment", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "descriptionHash", type: "string" },
      { name: "deliverableHash", type: "string" },
      { name: "status", type: "uint8" },
      { name: "createdAt", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "taskCounter",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const STATUS_MAP: Record<number, string> = {
  0: "Created",
  1: "Funded",
  2: "InProgress",
  3: "Submitted",
  4: "Completed",
  5: "Failed",
  6: "Disputed",
  7: "Resolved",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export default function NetworkGraphPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const contracts = getContractAddresses(chainId);
  const publicClient = usePublicClient();

  const [agents, setAgents] = useState<
    Array<{
      address: string;
      name: string;
      reputation: number;
      tasksCompleted: number;
      isActive: boolean;
    }>
  >([]);
  const [tasks, setTasks] = useState<
    Array<{
      id: string;
      client: string;
      worker: string;
      payment: bigint;
      status: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch on-chain data
  useEffect(() => {
    async function fetchData() {
      if (!publicClient || !contracts.AgentRegistry || !contracts.TaskEscrow) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Get counts
        const [agentCount, taskCount] = await Promise.all([
          publicClient.readContract({
            address: contracts.AgentRegistry as `0x${string}`,
            abi: AGENT_REGISTRY_ABI,
            functionName: "agentCount",
          }),
          publicClient.readContract({
            address: contracts.TaskEscrow as `0x${string}`,
            abi: TASK_ESCROW_ABI,
            functionName: "taskCounter",
          }),
        ]);

        // Fetch agents (limit to first 20 for performance)
        const agentPromises = [];
        const numAgents = Math.min(Number(agentCount), 20);
        for (let i = 0; i < numAgents; i++) {
          agentPromises.push(
            publicClient.readContract({
              address: contracts.AgentRegistry as `0x${string}`,
              abi: AGENT_REGISTRY_ABI,
              functionName: "agents",
              args: [BigInt(i)],
            })
          );
        }

        // Fetch tasks (limit to first 20)
        const taskPromises = [];
        const numTasks = Math.min(Number(taskCount), 20);
        for (let i = 0; i < numTasks; i++) {
          taskPromises.push(
            publicClient.readContract({
              address: contracts.TaskEscrow as `0x${string}`,
              abi: TASK_ESCROW_ABI,
              functionName: "tasks",
              args: [BigInt(i + 1)], // Tasks are 1-indexed
            })
          );
        }

        const [agentResults, taskResults] = await Promise.all([
          Promise.all(agentPromises),
          Promise.all(taskPromises),
        ]);

        // Transform agent data (viem returns tuple, not named properties)
        const agentsData = agentResults.map((agent, idx) => ({
          address: agent[1], // walletAddress
          name: agent[2] || `Agent ${idx}`, // name
          reputation: Number(agent[4]), // reputation
          tasksCompleted: Number(agent[5]), // tasksCompleted
          isActive: agent[7], // isActive
        }));

        // Transform task data (viem returns tuple)
        const tasksData = taskResults.map((task, idx) => ({
          id: String(idx + 1),
          client: task[0], // client
          worker: task[1], // worker
          payment: task[2], // payment
          status: STATUS_MAP[Number(task[6])] || "Unknown", // status
        }));

        // If no on-chain data, generate demo data
        if (agentsData.length === 0) {
          setAgents([
            { address: "0x1234567890abcdef1234567890abcdef12345678", name: "Alpha Agent", reputation: 850, tasksCompleted: 12, isActive: true },
            { address: "0xabcdef1234567890abcdef1234567890abcdef12", name: "Beta Agent", reputation: 720, tasksCompleted: 8, isActive: true },
            { address: "0x9876543210fedcba9876543210fedcba98765432", name: "Gamma Agent", reputation: 650, tasksCompleted: 5, isActive: true },
            { address: "0xfedcba9876543210fedcba9876543210fedcba98", name: "Delta Agent", reputation: 480, tasksCompleted: 2, isActive: false },
          ]);
          setTasks([
            { id: "1", client: "0x1234567890abcdef1234567890abcdef12345678", worker: "0xabcdef1234567890abcdef1234567890abcdef12", payment: BigInt("1000000000000000000"), status: "Completed" },
            { id: "2", client: "0x1234567890abcdef1234567890abcdef12345678", worker: "0x9876543210fedcba9876543210fedcba98765432", payment: BigInt("500000000000000000"), status: "InProgress" },
            { id: "3", client: "0xabcdef1234567890abcdef1234567890abcdef12", worker: "0xfedcba9876543210fedcba9876543210fedcba98", payment: BigInt("250000000000000000"), status: "Open" },
          ]);
        } else {
          setAgents(agentsData);
          setTasks(tasksData);
        }
      } catch (err) {
        console.error("Failed to fetch on-chain data:", err);
        setError("Failed to load on-chain data. Using demo data.");
        // Use demo data on error
        setAgents([
          { address: "0x1234567890abcdef1234567890abcdef12345678", name: "Alpha Agent", reputation: 850, tasksCompleted: 12, isActive: true },
          { address: "0xabcdef1234567890abcdef1234567890abcdef12", name: "Beta Agent", reputation: 720, tasksCompleted: 8, isActive: true },
          { address: "0x9876543210fedcba9876543210fedcba98765432", name: "Gamma Agent", reputation: 650, tasksCompleted: 5, isActive: true },
        ]);
        setTasks([
          { id: "1", client: "0x1234567890abcdef1234567890abcdef12345678", worker: "0xabcdef1234567890abcdef1234567890abcdef12", payment: BigInt("1000000000000000000"), status: "Completed" },
        ]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [publicClient, contracts, refreshKey]);

  const handleNodeClick = (node: { id: string; type: string }) => {
    if (node.type === "agent") {
      console.log("Clicked agent:", node.id);
    } else {
      console.log("Clicked task:", node.id);
    }
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <GitBranch size={40} className="text-info" />
              Agent Network Graph
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Connect your wallet to view the live agent-task network visualization.
            </p>
          </div>
          <Card className="p-8 text-center">
            <p className="text-muted mb-4">Please connect your wallet to continue.</p>
            <Link href="/">
              <Button variant="secondary">Go to Home to Connect</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen py-8 px-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/network">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft size={16} />
                Back to Network
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
            <GitBranch size={36} className="text-info" />
            Agent Network Graph
          </h1>
          <p className="text-muted font-body text-sm">
            Interactive visualization of agents and tasks. Drag nodes to reposition, scroll to zoom.
            Node size = reputation. Edge thickness = task value.
          </p>
        </motion.div>

        {/* Error banner */}
        {error && (
          <motion.div variants={itemVariants} className="mb-4">
            <Card className="p-4 border-warning/50 bg-warning/5">
              <p className="text-warning text-sm font-mono">{error}</p>
            </Card>
          </motion.div>
        )}

        {/* Graph Container */}
        <motion.div variants={itemVariants}>
          <Card className="overflow-hidden border border-border">
            <div className="h-[600px] relative">
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-surface-alt/50">
                  <div className="text-center">
                    <RefreshCw size={32} className="animate-spin text-info mx-auto mb-4" />
                    <p className="text-muted font-mono text-sm">Loading network data...</p>
                  </div>
                </div>
              ) : agents.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <GitBranch size={48} className="text-muted mx-auto mb-4 opacity-50" />
                    <p className="text-muted font-mono">No agents registered yet</p>
                    <p className="text-muted text-sm mt-2">
                      Register agents to see the network visualization
                    </p>
                  </div>
                </div>
              ) : (
                <D3NetworkGraph
                  agents={agents}
                  tasks={tasks}
                  width={800}
                  height={600}
                  onNodeClick={handleNodeClick}
                  className="w-full h-full"
                />
              )}
            </div>
          </Card>
        </motion.div>

        {/* Stats summary */}
        <motion.div variants={itemVariants} className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 border-accent/30">
            <p className="text-2xl font-heading font-bold text-foreground">{agents.length}</p>
            <p className="text-muted font-mono text-xs mt-1">Agents</p>
          </Card>
          <Card className="p-4 border-info/30">
            <p className="text-2xl font-heading font-bold text-foreground">{tasks.length}</p>
            <p className="text-muted font-mono text-xs mt-1">Tasks</p>
          </Card>
          <Card className="p-4 border-warning/30">
            <p className="text-2xl font-heading font-bold text-foreground">
              {tasks.filter((t) => t.status === "Completed").length}
            </p>
            <p className="text-muted font-mono text-xs mt-1">Completed</p>
          </Card>
          <Card className="p-4 border-danger/30">
            <p className="text-2xl font-heading font-bold text-foreground">
              {agents.filter((a) => a.isActive).length}
            </p>
            <p className="text-muted font-mono text-xs mt-1">Active Agents</p>
          </Card>
        </motion.div>

        {/* Instructions */}
        <motion.div variants={itemVariants} className="mt-6">
          <Card className="p-4 bg-surface-alt/30">
            <h3 className="font-heading font-semibold text-foreground mb-2 text-sm">
              How to Use
            </h3>
            <ul className="text-muted text-xs font-mono space-y-1">
              <li>• <strong>Drag</strong> nodes to reposition them</li>
              <li>• <strong>Scroll</strong> to zoom in/out</li>
              <li>• <strong>Hover</strong> over nodes for details</li>
              <li>• <strong>Node size</strong> reflects agent reputation</li>
              <li>• <strong>Edge thickness</strong> reflects task payment amount</li>
            </ul>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
