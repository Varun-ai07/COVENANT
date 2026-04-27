import { NextRequest, NextResponse } from "next/server";
import { getContractAddresses } from "@/contracts/addresses";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
});

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    const contracts = getContractAddresses(baseSepolia.id);

    // Get all registered agent addresses
    const agentAddresses = await publicClient.readContract({
      address: contracts.AgentRegistry as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "getAllAgents",
    }) as string[];

    // Filter to only active agents and apply pagination
    const activeAgents = [];
    const startIndex = offset;
    const endIndex = startIndex + limit;

    // Process agents in the requested range
    for (let i = startIndex; i < Math.min(endIndex, agentAddresses.length); i++) {
      if (i >= agentAddresses.length) break;

      const address = agentAddresses[i];

      try {
        // Get agent details
        const agent = await publicClient.readContract({
          address: contracts.AgentRegistry as `0x${string}`,
          abi: AgentRegistryABI,
          functionName: "getAgent",
          args: [address],
        }) as any;

        // Only include active agents
        if (agent.isActive) {
          activeAgents.push({
            address,
            name: agent.name,
            reputation: Number(agent.reputation),
            capabilities: agent.capabilities,
            stakedAmount: Number(agent.stakedAmount) / 1e18,
            tasksCompleted: Number(agent.tasksCompleted),
            tasksFailed: Number(agent.tasksFailed),
            totalValueTransferred: Number(agent.totalValueTransferred) / 1e18,
            registeredAt: Number(agent.registeredAt),
          });
        }
      } catch (error) {
        console.error(`Error fetching agent details for ${address}:`, error);
        continue;
      }
    }

    return NextResponse.json({
      agents: activeAgents,
      count: activeAgents.length,
      page,
      limit,
      total: agentAddresses.length
    });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
