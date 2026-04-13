import { NextRequest, NextResponse } from "next/server";
import { getContractAddresses } from "@/contracts/addresses";
import TaskEscrowABI from "@/contracts/TaskEscrow.json";
import AgentRegistryABI from "@/contracts/AgentRegistry.json";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const statusFilter = searchParams.get("status") || undefined;
    const sortBy = searchParams.get("sort") || "created";
    const order = searchParams.get("order") || "desc";

    const contracts = getContractAddresses(baseSepolia.id);
    const taskCount = await publicClient.readContract({
      address: contracts.TaskEscrow as `0x${string}`,
      abi: TaskEscrowABI,
      functionName: "taskCounter",
    }) as bigint;

    // Get all tasks with pagination support
    const totalTasks = Number(taskCount);
    const startIndex = Math.max(0, totalTasks - offset - limit);
    const endIndex = Math.max(0, totalTasks - offset);
    
    const tasksPromises = [];
    for (let i = startIndex; i < endIndex; i++) {
      tasksPromises.push(
        publicClient.readContract({
          address: contracts.TaskEscrow as `0x${string}`,
          abi: TaskEscrowABI,
          functionName: "getTask",
          args: [BigInt(i)],
        })
      );
    }

    const tasksData = await Promise.all(tasksPromises);
    const tasks = [];

    tasksData.forEach((taskData, index) => {
      try {
        const taskIndex = startIndex + index;
        const [
          client,
          worker,
          payment,
          deadline,
          descriptionHash,
          deliverableHash,
          statusNum,
          createdAt,
          completedAt,
        ] = taskData as [string, string, bigint, bigint, string, string, number, bigint, bigint];

        // Apply status filter if provided
        if (statusFilter !== undefined && Number(statusNum) !== parseInt(statusFilter)) {
          return;
        }

        tasks.push({
          id: BigInt(taskIndex),
          client,
          worker,
          payment: payment as bigint,
          deadline: deadline as bigint,
          descriptionHash,
          deliverableHash,
          status: statusNum,
          createdAt: createdAt as bigint,
          completedAt: completedAt as bigint,
        });
      } catch (error) {
        console.error(`Error processing task data:`, error);
      }
    });

    // Sort tasks
    tasks.sort((a, b) => {
      if (sortBy === "payment") {
        return order === "asc" 
          ? Number(a.payment) - Number(b.payment) 
          : Number(b.payment) - Number(a.payment);
      } else if (sortBy === "deadline") {
        return order === "asc" 
          ? Number(a.deadline) - Number(b.deadline) 
          : Number(b.deadline) - Number(a.deadline);
      } else { // Default to createdAt
        return order === "asc" 
          ? Number(a.createdAt) - Number(b.createdAt) 
          : Number(b.createdAt) - Number(a.createdAt);
      }
    });

    return NextResponse.json({ 
      tasks, 
      total: totalTasks,
      pageInfo: {
        limit,
        offset,
        hasMore: offset + limit < totalTasks
      }
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}
