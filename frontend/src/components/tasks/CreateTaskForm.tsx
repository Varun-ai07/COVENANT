"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useCreateTask } from "@/hooks/useTask";
import { NeonButton } from "@/components/ui/NeonButton";
import { GlassCard } from "@/components/ui/GlassCard";
import { Loader2, Send } from "lucide-react";

interface CreateTaskFormProps {
  onSuccess?: (taskId: bigint) => void;
  className?: string;
}

export default function CreateTaskForm({
  onSuccess,
  className = "",
}: CreateTaskFormProps) {
  const { address } = useAccount();
  const { createTask, isPending, isConfirming, isConfirmed, error } = useCreateTask();

  const [worker, setWorker] = useState("");
  const [payment, setPayment] = useState("");
  const [deadlineHours, setDeadlineHours] = useState("");
  const [descriptionHash, setDescriptionHash] = useState("");

  const isLoading = isPending || isConfirming;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!worker || !payment || !deadlineHours || !descriptionHash) {
      return;
    }

    const paymentWei = parseEther(payment);
    const deadlineSeconds = BigInt(Number(deadlineHours) * 3600);
    const deadline = BigInt(Math.floor(Date.now() / 1000)) + deadlineSeconds;

    createTask(
      worker as `0x${string}`,
      paymentWei,
      deadline,
      descriptionHash
    );
  };

  if (isConfirmed) {
    return (
      <GlassCard className={`p-6 ${className}`}>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-synapse-violet/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-synapse-violet" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-heading text-xl text-white">Task Created!</h3>
          <p className="text-sm text-gray-400">
            Your task has been successfully created and funded.
          </p>
          <NeonButton
            onClick={() => {
              setWorker("");
              setPayment("");
              setDeadlineHours("");
              setDescriptionHash("");
            }}
          >
            Create Another
          </NeonButton>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className={`p-6 ${className}`}>
      <h3 className="font-heading text-xl text-white mb-6">Create New Task</h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Worker Address */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-gray-300">
            Worker Address
          </label>
          <input
            type="text"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2.5 bg-neural-dark border border-glass-border rounded-xl text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-synapse-violet/50 focus:ring-1 focus:ring-synapse-violet/30 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Payment */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-gray-300">
            Payment (ETH)
          </label>
          <input
            type="number"
            step="0.001"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            placeholder="0.01"
            className="w-full px-4 py-2.5 bg-neural-dark border border-glass-border rounded-xl text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-synapse-violet/50 focus:ring-1 focus:ring-synapse-violet/30 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-gray-300">
            Deadline (hours from now)
          </label>
          <input
            type="number"
            value={deadlineHours}
            onChange={(e) => setDeadlineHours(e.target.value)}
            placeholder="24"
            className="w-full px-4 py-2.5 bg-neural-dark border border-glass-border rounded-xl text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-synapse-violet/50 focus:ring-1 focus:ring-synapse-violet/30 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Description Hash */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-gray-300">
            Description Hash (IPFS)
          </label>
          <input
            type="text"
            value={descriptionHash}
            onChange={(e) => setDescriptionHash(e.target.value)}
            placeholder="Qm..."
            className="w-full px-4 py-2.5 bg-neural-dark border border-glass-border rounded-xl text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-synapse-violet/50 focus:ring-1 focus:ring-synapse-violet/30 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error.message || "Transaction failed"}
          </div>
        )}

        {/* Submit Button */}
        <NeonButton
          type="submit"
          loading={isLoading}
          disabled={isLoading || !worker || !payment || !deadlineHours || !descriptionHash}
          className="w-full"
        >
          <Send size={16} />
          {isPending ? "Confirming in Wallet..." : isConfirming ? "Waiting for Confirmation..." : "Create & Fund Task"}
        </NeonButton>
      </form>
    </GlassCard>
  );
}
