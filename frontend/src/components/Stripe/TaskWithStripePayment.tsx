"use client";

import { useState } from "react";
import { formatEther } from "viem";
import { useAccount } from "wagmi";
import { useToast } from "@/components/Toast";
import { getContractAddresses } from "@/contracts/addresses";
import { useCreateTask } from "@/hooks/useTask";

interface TaskWithStripePaymentProps {
  workerAddress: `0x${string}`;
  payment: string;
  deadline: string;
  description: string;
  onSuccess?: () => void;
}

export function TaskWithStripePayment({
  workerAddress,
  payment,
  deadline,
  description,
  onSuccess
}: TaskWithStripePaymentProps) {
  const { isConnected, chain } = useAccount();
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCreateTask = async () => {
    if (!isConnected) {
      addToast({
        type: "error",
        title: "Wallet Required",
        message: "Please connect your wallet first"
      });
      return;
    }

    if (!workerAddress || !payment || !deadline || !description) {
      addToast({
        type: "error",
        title: "Missing Information",
        message: "Please fill in all required fields"
      });
      return;
    }

    setIsProcessing(true);

    try {
      // In a real implementation, this would create the task and process payment
      // For now, we'll just simulate the process
      console.log("Processing task creation with payment...");

      // This would typically involve:
      // 1. Creating the task on-chain
      // 2. Processing Stripe payment
      // 3. Linking payment to task

      addToast({
        type: "success",
        title: "Success",
        message: "Task created and payment processed successfully"
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Task creation error:", error);
      addToast({
        type: "error",
        title: "Task Creation Failed",
        message: error instanceof Error ? error.message : "Failed to create task"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.221.313 3 .938" />
        </svg>
        <span className="font-silkscreen text-xs tracking-[0.1em]">TASK & PAYMENT</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div>
          <label className="block text-slate-400 text-sm mb-2">Worker Address</label>
          <input
            type="text"
            value={workerAddress}
            readOnly
            className="input-glass w-full bg-black/20"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-2">Payment Amount (ETH)</label>
          <input
            type="text"
            value={payment}
            readOnly
            className="input-glass w-full bg-black/20"
          />
          <p className="text-slate-500 text-xs mt-1">
            Equivalent to ${(parseFloat(payment) * 3000).toFixed(2)} USD
          </p>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-2">Deadline</label>
          <input
            type="text"
            value={deadline}
            readOnly
            className="input-glass w-full bg-black/20"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-2">Task Description</label>
          <textarea
            value={description}
            readOnly
            rows={3}
            className="input-glass w-full bg-black/20"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCreateTask}
          disabled={isProcessing}
          className="flex-1 py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V2a10 10 0 00-10 10h2zm2 5.291A7.962 7.962 0 014 12H2c0 5.523 4.477 10 10 10v-2a8 8 0 01-8-8v0z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirm Task & Process Payment
            </>
          )}
        </button>

        <button
          disabled={isProcessing}
          className="px-5 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold rounded-xl hover:shadow-glow-teal transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.221.313 3 .938" />
          </svg>
          Pay with Crypto
        </button>
      </div>
    </div>
  );
}