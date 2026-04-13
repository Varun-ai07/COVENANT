import { NextRequest, NextResponse } from "next/server";
import { getContractAddresses } from "@/contracts/addresses";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
});

export async function GET() {
  try {
    const contracts = getContractAddresses(baseSepolia.id);
    
    // Get agent count
    const agentCount = await publicClient.readContract({
      address: contracts.AgentRegistry as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "getAgentCount",
    }) as bigint;
    
    // Get task count
    const taskCount = await publicClient.readContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "taskCounter",
    }) as bigint;
    
    // Get receipt count
    const receiptCount = await publicClient.readContract({
      address: contracts.ReceiptVerifier as `0x${string}`,
      abi: ReceiptVerifierABI,
      functionName: "receiptCounter",
    }) as bigint;
    
    // Get agent stats (mock data since we don't have view functions for all stats)
    // In production, these would come from subgraphs or additional view functions
    const agentStats = {
      activeTasks: Math.floor(Number(taskCount) * 0.3), // Assume 30% of tasks are active
      completedToday: Math.floor(Math.random() * 10), // Mock daily completed tasks
      totalVolumeETH: parseFloat((Math.random() * 50).toFixed(2)), // Mock total volume
      successRate: 85 + Math.floor(Math.random() * 10), // Mock success rate 85-95%
      avgReputation: 600 + Math.floor(Math.random() * 300) // Mock avg reputation 600-900
    };
    
    // Get reputation distribution (mock data)
    const reputationDistribution = [
      { range: "0-399", count: Math.floor(Number(agentCount) * 0.2) },
      { range: "400-599", count: Math.floor(Number(agentCount) * 0.3) },
      { range: "600-799", count: Math.floor(Number(agentCount) * 0.3) },
      { range: "800-1000", count: Math.floor(Number(agentCount) * 0.2) }
    ];
    
    // Ensure counts don't exceed total agent count
    let totalDistributed = reputationDistribution.reduce((sum, item) => sum + item.count, 0);
    if (totalDistributed > Number(agentCount)) {
      // Scale down proportionally
      const scaleFactor = Number(agentCount) / totalDistributed;
      reputationDistribution.forEach(item => {
        item.count = Math.floor(item.count * scaleFactor);
      });
    }
    
    const stats = {
      agentCount: Number(agentCount),
      taskCount: Number(taskCount),
      receiptCount: Number(receiptCount),
      agentStats,
      reputationDistribution
    };
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching network stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch network stats" },
      { status: 500 }
    );
  }
}