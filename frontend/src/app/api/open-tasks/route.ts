import { NextRequest, NextResponse } from "next/server";
import { getContractAddresses } from "@/contracts/addresses";
import OpenTaskMarketABI from "@/contracts/OpenTaskMarket.json";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org"),
});

interface OpenTask {
  id: bigint;
  client: string;
  worker: string;
  maxPayment: bigint;
  deadline: bigint;
  descriptionHash: string;
  status: number;
  postedAt: bigint;
  selectedWorker: string;
  selectedPrice: bigint;
  selectedTimeEstimate: bigint;
  selectedProposalHash: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const contracts = getContractAddresses(baseSepolia.id);
    const taskCount = await publicClient.readContract({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "taskCounter",
    }) as bigint;

    const totalTasks = Number(taskCount);
    const startIndex = Math.max(1, totalTasks - offset - limit);
    const endIndex = Math.max(1, totalTasks - offset);

    const rangeSize = Math.min(endIndex - startIndex + 1, limit * 3);
    const actualStartIndex = Math.max(1, endIndex - rangeSize + 1);

    const tasksPromises = [];
    for (let i = actualStartIndex; i <= endIndex; i++) {
      tasksPromises.push(
        publicClient.readContract({
          address: contracts.OpenTaskMarket as `0x${string}`,
          abi: OpenTaskMarketABI,
          functionName: "getTask",
          args: [BigInt(i)],
        })
      );
    }

    const tasksData = await Promise.all(tasksPromises);
    const openTasks: OpenTask[] = [];

    tasksData.forEach((taskData, index) => {
      try {
        const taskIndex = actualStartIndex + index;
        const [
          client,
          worker,
          maxPayment,
          deadline,
          descriptionHash,
          statusNum,
          postedAt,
          selectedWorker,
          selectedPrice,
          selectedTimeEstimate,
          selectedProposalHash
        ] = taskData as [string, string, bigint, bigint, string, number, bigint, string, bigint, bigint, string];

        if (Number(statusNum) === 0) {
          openTasks.push({
            id: BigInt(taskIndex),
            client,
            worker,
            maxPayment: maxPayment as bigint,
            deadline: deadline as bigint,
            descriptionHash,
            status: statusNum,
            postedAt: postedAt as bigint,
            selectedWorker,
            selectedPrice: selectedPrice as bigint,
            selectedTimeEstimate: selectedTimeEstimate as bigint,
            selectedProposalHash
          });
        }
      } catch (error) {
        console.error(`Error processing open task data at index ${actualStartIndex + index}:`, error);
      }
    });

    openTasks.sort((a, b) => Number(b.postedAt) - Number(a.postedAt));

    const limitedTasks = openTasks.slice(0, limit);

    return NextResponse.json({
      tasks: limitedTasks,
      total: openTasks.length,
      pageInfo: {
        limit,
        offset,
        hasMore: offset + limit < totalTasks
      }
    });
  } catch (error) {
    console.error("Error fetching open tasks:", error);
    return NextResponse.json({ error: "Failed to fetch open tasks" }, { status: 500 });
  }
}
