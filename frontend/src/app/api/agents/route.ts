import { NextRequest, NextResponse } from "next/server";
import { getContractAddresses } from "@/contracts/addresses";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
});

export async function GET() {
  try {
    const contracts = getContractAddresses(baseSepolia.id);
    const agentCount = await publicClient.readContract({
      address: contracts.AgentRegistry as `0x${string}`,
      abi: AgentRegistryABI,
      functionName: "getAgentCount",
    }) as bigint;

    const count = Number(agentCount);
    const agents = [];

    for (let i = 0; i < count; i++) {
      try {
        const [address, name, reputation, capabilities, stakedAmount, tasksCompleted, tasksFailed, totalValueTransferred, isActive, registeredAt] =
          (await publicClient.readContract({
            address: contracts.AgentRegistry as `0x${string}`,
            abi: AgentRegistryABI,
            functionName: "getAgentAtIndex",
            args: [i],
          })) as [string, string, bigint, string[], bigint, bigint, bigint, bigint, boolean, bigint];

        if (isActive) {
          agents.push({
            address,
            name,
            reputation: Number(reputation),
            capabilities,
            stakedAmount: Number(stakedAmount) / 1e18,
            tasksCompleted: Number(tasksCompleted),
            tasksFailed: Number(tasksFailed),
            totalValueTransferred: Number(totalValueTransferred) / 1e18,
            registeredAt: Number(registeredAt),
          });
        }
      } catch (error) {
        console.error(`Error fetching agent at index ${i}:`, error);
        continue;
      }
    }

    return NextResponse.json({ agents, count: agents.length });
  } catch (error) {
    console.error("Error fetching agents:", error);
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
