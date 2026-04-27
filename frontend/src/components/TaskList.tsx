// TaskList component that uses the shared TaskDisplay component
import { TaskDisplay } from "@/components/TaskDisplay";
import { getContractAddresses } from "@/contracts/addresses";

interface TaskListProps {
  tasks: bigint[];
  contracts: ReturnType<typeof getContractAddresses>;
  className?: string;
}

export function TaskList({ tasks, contracts, className = "" }: TaskListProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {tasks.map((taskId) => (
        <TaskDisplay key={taskId.toString()} taskId={taskId} contracts={contracts} />
      ))}
    </div>
  );
}

export default TaskList;