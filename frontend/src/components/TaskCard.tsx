"use client";

import Link from "next/link";
import { getContractAddresses } from "@/contracts/addresses";
import { TaskDisplay } from "@/components/TaskDisplay";

interface TaskCardProps {
  taskId: bigint;
  contracts: ReturnType<typeof getContractAddresses>;
  highlight?: boolean;
}

export function TaskCard({ taskId, contracts, highlight = false }: TaskCardProps) {
  return (
    <Link href={`/tasks/${taskId}`}>
      <div className={highlight ? "border-violet-500/30 shadow-glow-violet/50" : ""}>
        <TaskDisplay taskId={taskId} contracts={contracts} />
      </div>
    </Link>
  );
}
