"use client";

import { useEffect } from "react";
import { TaskStatus } from "@/types";
import { useSubmitWork, useVerifyTask, useDisputeTask } from "@/hooks/useTask";
import { useToast } from "@/components/Toast";

interface TaskActionsProps {
  taskId: bigint;
  status: TaskStatus;
  isClient: boolean;
  isWorker: boolean;
  onSuccess?: () => void;
}

export function TaskActions({ taskId, status, isClient, isWorker, onSuccess }: TaskActionsProps) {
  const { addToast } = useToast();

  const {
    submitWork,
    isPending: isSubmitPending,
    isConfirming: isSubmitConfirming,
    isSuccess: isSubmitSuccess,
    hash: submitHash,
    error: submitError,
  } = useSubmitWork();

  const {
    verifyTask,
    isPending: isVerifyPending,
    isConfirming: isVerifyConfirming,
    isSuccess: isVerifySuccess,
    hash: verifyHash,
    error: verifyError,
  } = useVerifyTask();

  const {
    disputeTask,
    isPending: isDisputePending,
    isConfirming: isDisputeConfirming,
    isSuccess: isDisputeSuccess,
    hash: disputeHash,
    error: disputeError,
  } = useDisputeTask();

  useEffect(() => {
    if (isSubmitSuccess) {
      addToast({ type: "success", title: "Work Submitted", message: "Deliverable uploaded successfully", txHash: submitHash });
      onSuccess?.();
    }
  }, [isSubmitSuccess, submitHash]);

  useEffect(() => {
    if (isVerifySuccess) {
      addToast({ type: "success", title: "Task Verified", message: "Task has been verified", txHash: verifyHash });
      onSuccess?.();
    }
  }, [isVerifySuccess, verifyHash]);

  useEffect(() => {
    if (isDisputeSuccess) {
      addToast({ type: "warning", title: "Dispute Raised", message: "Task is now under dispute", txHash: disputeHash });
      onSuccess?.();
    }
  }, [isDisputeSuccess, disputeHash]);

  useEffect(() => {
    if (submitError) {
      const msg = submitError.message?.includes("User rejected") ? "Transaction rejected" : submitError.message?.slice(0, 100);
      addToast({ type: "error", title: "Submit Failed", message: msg });
    }
  }, [submitError]);

  useEffect(() => {
    if (verifyError) {
      const msg = verifyError.message?.includes("User rejected") ? "Transaction rejected" : verifyError.message?.slice(0, 100);
      addToast({ type: "error", title: "Verify Failed", message: msg });
    }
  }, [verifyError]);

  useEffect(() => {
    if (disputeError) {
      const msg = disputeError.message?.includes("User rejected") ? "Transaction rejected" : disputeError.message?.slice(0, 100);
      addToast({ type: "error", title: "Dispute Failed", message: msg });
    }
  }, [disputeError]);

  const handleSubmitWork = () => {
    const deliverableHash = `QmSubmit${Date.now().toString(36)}`;
    submitWork(taskId, deliverableHash);
  };

  const handleVerify = (success: boolean) => {
    verifyTask(taskId, success);
  };

  const handleDispute = () => {
    disputeTask(taskId);
  };

  const isLoading =
    isSubmitPending ||
    isSubmitConfirming ||
    isVerifyPending ||
    isVerifyConfirming ||
    isDisputePending ||
    isDisputeConfirming;

  return (
    <div className="space-y-4">
      {/* Worker Actions */}
      {isWorker && status === TaskStatus.InProgress && (
        <button
          onClick={handleSubmitWork}
          disabled={isLoading}
          className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold rounded-xl hover:shadow-glow-emerald transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {isSubmitPending
            ? "Confirm in wallet..."
            : isSubmitConfirming
            ? "Submitting work..."
            : "Submit Work"}
        </button>
      )}

      {/* Client Actions */}
      {isClient && status === TaskStatus.Submitted && (
        <div className="flex gap-4">
          <button
            onClick={() => handleVerify(true)}
            disabled={isLoading}
            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-semibold rounded-xl hover:shadow-glow-emerald transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {isVerifyPending
              ? "Confirm..."
              : isVerifyConfirming
              ? "Approving..."
              : "Approve Work"}
          </button>
          <button
            onClick={() => handleVerify(false)}
            disabled={isLoading}
            className="flex-1 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold rounded-xl hover:shadow-red-500/20 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {isVerifyPending
              ? "Confirm..."
              : isVerifyConfirming
              ? "Rejecting..."
              : "Reject Work"}
          </button>
        </div>
      )}

      {/* Dispute Action (both parties) */}
      {(isClient || isWorker) &&
        (status === TaskStatus.InProgress || status === TaskStatus.Submitted) && (
          <button
            onClick={handleDispute}
            disabled={isLoading}
            className="w-full py-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 font-medium rounded-xl hover:bg-orange-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {isDisputePending
              ? "Confirm..."
              : isDisputeConfirming
              ? "Disputing..."
              : "Raise Dispute"}
          </button>
        )}

      {/* Status message for terminal states */}
      {status === TaskStatus.Completed && (
        <div className="text-center py-4 px-4 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Task completed successfully
        </div>
      )}
      {status === TaskStatus.Failed && (
        <div className="text-center py-4 px-4 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Task failed - refund issued to client
        </div>
      )}
      {status === TaskStatus.Disputed && (
        <div className="text-center py-4 px-4 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20 flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Task under dispute - awaiting resolution
        </div>
      )}
    </div>
  );
}
