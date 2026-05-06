"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther } from "viem";
import { useCreateTask } from "@/hooks/useTask";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
      <Card className={`p-6 ${className}`}>
        <div className="text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-accent/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-heading text-xl text-foreground">Task Created!</h3>
          <p className="text-sm text-muted">
            Your task has been successfully created and funded.
          </p>
          <Button
            onClick={() => {
              setWorker("");
              setPayment("");
              setDeadlineHours("");
              setDescriptionHash("");
            }}
          >
            Create Another
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      <h3 className="font-heading text-xl text-foreground mb-6">Create New Task</h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Worker Address */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-foreground/70">
            Worker Address
          </label>
          <input
            type="text"
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-foreground placeholder-muted/50 font-mono text-sm focus:outline-none focus:border-accent/50 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Payment */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-foreground/70">
            Payment (ETH)
          </label>
          <input
            type="number"
            step="0.001"
            value={payment}
            onChange={(e) => setPayment(e.target.value)}
            placeholder="0.01"
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-foreground placeholder-muted/50 font-mono text-sm focus:outline-none focus:border-accent/50 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Deadline */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-foreground/70">
            Deadline (hours from now)
          </label>
          <input
            type="number"
            value={deadlineHours}
            onChange={(e) => setDeadlineHours(e.target.value)}
            placeholder="24"
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-foreground placeholder-muted/50 font-mono text-sm focus:outline-none focus:border-accent/50 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Description Hash */}
        <div className="space-y-2">
          <label className="block text-sm font-mono text-foreground/70">
            Description Hash (IPFS)
          </label>
          <input
            type="text"
            value={descriptionHash}
            onChange={(e) => setDescriptionHash(e.target.value)}
            placeholder="Qm..."
            className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-foreground placeholder-muted/50 font-mono text-sm focus:outline-none focus:border-accent/50 transition-colors"
            disabled={isLoading}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm">
            {error.message || "Transaction failed"}
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          loading={isLoading}
          disabled={isLoading || !worker || !payment || !deadlineHours || !descriptionHash}
          className="w-full"
        >
          <Send size={16} />
          {isPending ? "Confirming in Wallet..." : isConfirming ? "Waiting for Confirmation..." : "Create & Fund Task"}
        </Button>
      </form>
    </Card>
  );
}
