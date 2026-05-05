"use client";

import { useAccount } from "wagmi";
import { useSubmitWork, useVerifyTask, useDisputeTask } from "@/hooks/useTask";
import { TaskStatus } from "@/types";
import { NeonButton } from "@/components/ui/NeonButton";
import { Loader2, Send, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface TaskActionsProps {
  taskId: bigint;
  status: TaskStatus | number;
  worker?: string;
  client?: string;
  className?: string;
}

export default function TaskActions({
  taskId,
  status,
  worker,
  client,
  className = "",
}: TaskActionsProps) {
  const { address } = useAccount();
  const normalizedStatus = typeof status === "number" ? status : status;

  const { submitWork, isPending: isSubmitting, isConfirming: isSubmitConfirming } = useSubmitWork();
  const { verifyTask, isPending: isVerifying, isConfirming: isVerifyConfirming } = useVerifyTask();
  const { disputeTask, isPending: isDisputing, isConfirming: isDisputeConfirming } = useDisputeTask();

  const isWorker = address?.toLowerCase() === worker?.toLowerCase();
  const isClient = address?.toLowerCase() === client?.toLowerCase();

  const isLoading = isSubmitting || isSubmitConfirming || isVerifying || isVerifyConfirming || isDisputing || isDisputeConfirming;

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {/* Submit Work - visible to worker when task is InProgress */}
      {isWorker && normalizedStatus === TaskStatus.InProgress && (
        <NeonButton
          onClick={() => {
            const deliverableHash = ""; // In real use, get from form
            submitWork(taskId, deliverableHash);
          }}
          loading={isSubmitting || isSubmitConfirming}
          disabled={isLoading}
        >
          <Send size={16} />
          Submit Work
        </NeonButton>
      )}

      {/* Verify Task - visible to client when task is Submitted */}
      {isClient && normalizedStatus === TaskStatus.Submitted && (
        <>
          <NeonButton
            onClick={() => verifyTask(taskId, true)}
            loading={isVerifying || isVerifyConfirming}
            disabled={isLoading}
            variant="primary"
          >
            <CheckCircle2 size={16} />
            Approve
          </NeonButton>
          <NeonButton
            onClick={() => verifyTask(taskId, false)}
            loading={isVerifying || isVerifyConfirming}
            disabled={isLoading}
            variant="danger"
          >
            <XCircle size={16} />
            Reject
          </NeonButton>
        </>
      )}

      {/* Dispute - visible to either party when task is Submitted */}
      {(isClient || isWorker) && normalizedStatus === TaskStatus.Submitted && (
        <NeonButton
          onClick={() => disputeTask(taskId)}
          loading={isDisputing || isDisputeConfirming}
          disabled={isLoading}
          variant="secondary"
        >
          <AlertTriangle size={16} />
          Dispute
        </NeonButton>
      )}

      {/* Show loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={14} className="animate-spin" />
          Processing transaction...
        </div>
      )}
    </div>
  );
}
