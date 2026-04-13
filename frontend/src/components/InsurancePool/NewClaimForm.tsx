"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { Agent } from "@/types";

interface NewClaimFormProps {
  agent: Agent | null;
  onSubmitClaim: (taskId: string) => void;
  onClose: () => void;
}

export default function NewClaimForm({
  agent,
  onSubmitClaim,
  onClose
}: NewClaimFormProps) {
  const { address } = useAccount();
  const [taskId, setTaskId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId.trim()) {
      setError("Please enter a task ID");
      return;
    }

    if (!address) {
      setError("Wallet not connected");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // In a real implementation, this would call the insurance contract
      // For now, we'll simulate the submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate successful claim submission
      setSuccess(true);
      setIsSubmitting(false);
      
      // Call the callback to notify parent
      onSubmitClaim(taskId);
      
      // Close form after a brief delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    }
  };

  return (
    <div className="glass-card p-6">
      <h2 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        FILE INSURANCE CLAIM
      </h2>
      
      {success && (
        <div className="mb-4 p-4 bg-green-500/20 rounded-xl border border-green-500/30">
          <p className="text-green-400 font-semibold">
            Claim submitted successfully! The governance committee will review it.
          </p>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 rounded-xl border border-red-500/30">
          <p className="text-red-400 font-semibold">
            {error}
          </p>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-slate-400 text-sm mb-2">
            Task ID to Claim For
          </label>
          <input
            type="number"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder="Enter task ID"
            className={`input-glass w-full ${isSubmitting ? "opacity-50" : ""}`}
            disabled={isSubmitting}
          />
        </div>
        
        <div className="text-slate-400 text-sm">
          <p className="mb-1">
            <strong>Important:</strong> You can only file a claim for tasks that:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>You are the worker for</li>
            <li>Have failed or been disputed</li>
            <li>You have paid premiums for</li>
          </ul>
          <p className="mt-2">
            Claims typically cover 50% of the task value plus a reputation top-up.
          </p>
        </div>
        
        {agent && (
          <div className="text-slate-400 text-sm">
            <p className="mb-1">
              <strong>Your Info:</strong>
            </p>
            <p className="text-slate-300">
              Address: {formatEther(BigInt(`0x${address.slice(2)}`))} ETH
            </p>
            <p className="text-slate-300">
              Reputation: {agent.reputation}/1000
            </p>
            <p className="text-slate-300">
              Tasks Completed: {agent.tasksCompleted}
            </p>
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white underline"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !taskId.trim()}
            className={`ml-4 px-4 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold rounded-xl hover:shadow-glow-red transition-all duration-300 ${
              isSubmitting ? "opacity-50" : ""
            }`}
          >
            {isSubmitting ? "SUBMITTING..." : "FILE CLAIM"}
          </button>
        </div>
      </form>
    </div>
  );
}