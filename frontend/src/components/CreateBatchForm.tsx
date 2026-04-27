"use client";

import { useState, useEffect } from "react";
import { parseEther } from "viem";

interface CreateBatchFormProps {
  batch: {
    workerAddresses: string[];
    payments: string[];
    deadline: string;
    taskSpecs: string[];
    aggregationSpec: string;
  };
  onChange: (value: any) => void;
  onCreate: () => Promise<void>;
  isCreating: boolean;
  workerAddress: string; // Current user's address for pre-filling
}

export default function CreateBatchForm({
  batch,
  onChange,
  onCreate,
  isCreating,
  workerAddress,
}: CreateBatchFormProps) {
  const [workerInputs, setWorkerInputs] = useState<Array<{
    address: string;
    payment: string;
    spec: string;
  }>>([{ address: workerAddress, payment: "0.001", spec: "" }]);
  const [deadline, setDeadline] = useState("");
  const [aggregationSpec, setAggregationSpec] = useState("");

  useEffect(() => {
    // Sync form state with props
    setWorkerInputs(
      batch.workerAddresses.map((addr, i) => ({
        address: addr,
        payment: batch.payments[i] || "0.001",
        spec: batch.taskSpecs[i] || "",
      }))
    );
    setDeadline(batch.deadline);
    setAggregationSpec(batch.aggregationSpec);
  }, [batch]);

  const handleAddWorker = () => {
    setWorkerInputs([...workerInputs, { address: workerAddress, payment: "0.001", spec: "" }]);
  };

  const handleRemoveWorker = (index: number) => {
    if (workerInputs.length <= 1) return;
    setWorkerInputs(workerInputs.filter((_, i) => i !== index));
  };

  const handleWorkerChange = (index: number, field: "address" | "payment" | "spec", value: string) => {
    setWorkerInputs(
      workerInputs.map((input, i) =>
        i === index ? { ...input, [field]: value } : input
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const workerAddresses = workerInputs.map(w => w.address);
    const payments = workerInputs.map(w => parseEther(w.payment).toString());
    const taskSpecs = workerInputs.map(w => w.spec);
    
    onChange({
      workerAddresses,
      payments,
      deadline,
      taskSpecs,
      aggregationSpec,
    });
    
    await onCreate();
  };

  return (
    <div className="glass-card p-6">
      <h2 className="font-silkscreen text-lg text-white mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c4 0 7 2 7 6 0 4-3 9-9 9s-9-5-9-9 3-6 7-6Z" />
        </svg>
        CREATE TASK BATCH
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Workers Section */}
        <div>
          <h3 className="font-silkscreen text-lg text-white mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-12 0a9 9 0 0112 0z" />
            </svg>
            WORKERS & TASKS ({workerInputs.length})
          </div>
          <button
            type="button"
            onClick={handleAddWorker}
            className="w-full flex justify-between px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="text-slate-400">ADD WORKER + TASK</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H7" />
            </svg>
          </button>
          {workerInputs.map((worker, index) => (
            <div key={index} className="border border-white/5 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-start mb-2">
                <span className="font-silkscreen text-sm">Worker #{index + 1}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveWorker(index)}
                  className="text-slate-400 hover:text-white text-xs"
                  disabled={workerInputs.length === 1}
                >
                  −
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Worker Address</label>
                  <input
                    type="text"
                    value={worker.address}
                    onChange={(e) => handleWorkerChange(index, "address", e.target.value)}
                    placeholder="0x..."
                    className="input-glass w-full"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Payment (ETH)</label>
                  <input
                    type="text"
                    value={worker.payment}
                    onChange={(e) => handleWorkerChange(index, "payment", e.target.value)}
                    placeholder="0.001"
                    className="input-glass w-full"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Task Specification</label>
                  <textarea
                    value={worker.spec}
                    onChange={(e) => handleWorkerChange(index, "spec", e.target.value)}
                    placeholder="Describe the task for this worker..."
                    className="input-glass w-full h-20"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Deadline */}
        <div>
          <label className="block text-slate-400 text-xs mb-1">Batch Deadline</label>
          <input
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="input-glass w-full"
          />
          <p className="text-slate-500 text-xs mt-1">
            Format: YYYY-MM-DDTHH:MM
          </p>
        </div>
        
        {/* Aggregation Spec */ifier */
        <div>
          <label className="block text-slate-400 text-xs mb-1">Results Aggregation Spec</label>
          <textarea
            value={aggregationSpec}
            onChange={(e) => setAggregationSpec(e.target.value)}
            placeholder="How should results from all workers be combined? (e.g., 'merge reports', 'average scores', 'concatenate outputs')"
            className="input-glass w-full h-20"
          />
        </div>
        
        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:shadow-glow-emerald transition-all duration-300 disabled:opacity-50 font-silkscreen text-xs tracking-[0.1em]"
          >
            {isCreating ? "CREATING BATCH..." : "CREATE BATCH"}
          </button>
        </div>
      </form>
    </div>
  );
}