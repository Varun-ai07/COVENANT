"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import { ResourcePreloader, MemoryManager } from "@/lib/performance-optimizations";
import { useTask, useVerifyTask } from "@/hooks/useTask";
import { useCreateVerificationReceipt, useGetSubmittedTasks } from "@/hooks/useVerifier";

// Initialize performance managers
const preloader = ResourcePreloader.getInstance();
const memoryManager = MemoryManager.getInstance();

type EngineCriterion = {
  id: string;
  label: string;
  stage: 1 | 2 | 3;
  weight: number;
  passed: boolean;
  details: string;
};

type EngineResult = {
  engine: string;
  taskId: number;
  success: boolean;
  score: number;
  deterministicScore: number;
  llmScore: number;
  feedback: string;
  criteria: EngineCriterion[];
  evaluatedAt: string;
  pipeline: {
    stage1Passed: boolean;
    stage2Passed: boolean;
    stage3Assessed: boolean;
    threshold: number;
  };
};

type VerificationHistoryItem = {
  taskId: string;
  score: number;
  status: "PASS" | "FAIL";
  timestamp: string;
  feedback: string;
};

export default function VerifierDashboard() {
  const { isConnected } = useAccount();
  const { submittedTaskIds, isLoading: submittedLoading, refetch: refetchSubmitted } = useGetSubmittedTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<bigint | undefined>(undefined);
  const { task, refetch: refetchTask } = useTask(selectedTaskId);
  const { verifyTask, isPending: isVerifyingOnChain, isConfirming: isConfirmingVerify } = useVerifyTask();
  const {
    createVerificationReceipt,
    isPending: isReceiptPending,
    isConfirming: isReceiptConfirming,
  } = useCreateVerificationReceipt();

  const [verificationStatus, setVerificationStatus] = useState("idle");
  const [verificationResult, setVerificationResult] = useState<EngineResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmittingOnChain, setIsSubmittingOnChain] = useState(false);
  const [hasSubmittedDecision, setHasSubmittedDecision] = useState(false);
  const [verificationHistoryState, setVerificationHistoryState] = useState<VerificationHistoryItem[]>([]);

  // Memoize verification history
  const verificationHistory = useMemo(() => {
    return verificationHistoryState;
  }, [verificationHistoryState]);

  useEffect(() => {
    preloader.preloadCriticalResources();

    return () => {
      memoryManager.clear();
    };
  }, []);

  useEffect(() => {
    if (submittedTaskIds.length > 0 && selectedTaskId === undefined) {
      setSelectedTaskId(submittedTaskIds[0]);
    }
  }, [submittedTaskIds, selectedTaskId]);

  const handleVerify = useCallback(async () => {
    if (isChecking || !selectedTaskId || !task) return;

    setVerificationStatus("processing");
    setIsChecking(true);
    setHasSubmittedDecision(false);

    try {
      const response = await fetch("/api/verifier/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: Number(selectedTaskId),
          deliverableHash: task.deliverableHash,
          descriptionHash: task.descriptionHash,
          deadline: Number(task.deadline),
          createdAt: Number(task.createdAt),
        }),
      });

      if (!response.ok) {
        throw new Error("Verification engine request failed");
      }

      const result = (await response.json()) as EngineResult;
      setVerificationResult(result);

      setVerificationStatus("verified");

      const historyItem: VerificationHistoryItem = {
        taskId: `#${String(result.taskId).padStart(4, "0")}`,
        score: result.score,
        status: result.success ? "PASS" : "FAIL",
        timestamp: "just now",
        feedback: result.feedback,
      };
      setVerificationHistoryState((prev) => [historyItem, ...prev].slice(0, 12));

      // Optimistic reward notification
      showNotification(result.success ? "Verification complete - ready for on-chain settlement." : "Verification complete - task did not meet threshold.");
    } catch (error) {
      console.error("Verification error:", error);
      setVerificationStatus("error");
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, selectedTaskId, task]);

  const handleSubmitDecision = useCallback(async () => {
    if (!selectedTaskId || !verificationResult || isSubmittingOnChain) {
      return;
    }

    setIsSubmittingOnChain(true);
    try {
      verifyTask(selectedTaskId, verificationResult.success);
      setHasSubmittedDecision(true);
      showNotification("Verification decision submitted on-chain.");
      refetchSubmitted();
      refetchTask();
    } catch (error) {
      console.error("Failed to submit verification decision:", error);
      showNotification("Failed to submit verification decision.");
    } finally {
      setIsSubmittingOnChain(false);
    }
  }, [isSubmittingOnChain, refetchSubmitted, refetchTask, selectedTaskId, verificationResult, verifyTask]);

  const handleCreateReceipt = useCallback(() => {
    if (!selectedTaskId || !verificationResult || !hasSubmittedDecision) {
      return;
    }

    createVerificationReceipt(
      selectedTaskId,
      verificationResult.success,
      verificationResult.score,
      verificationResult.feedback
    );
    showNotification("Verification receipt transaction submitted.");
  }, [createVerificationReceipt, hasSubmittedDecision, selectedTaskId, verificationResult]);

  const showNotification = (message: string) => {
    // Optimistic notification without blocking UI
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-500/20 border border-blue-500/30 rounded-lg p-4 z-50 animate-fade-in-up';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* Header */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50 bg-slate-900/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <h2 className="font-silkscreen text-xl text-white tracking-[0.15em]">
            VERIFIER ENGINE DASHBOARD
          </h2>
          <button
            onClick={handleVerify}
            disabled={isChecking || !selectedTaskId || !task || !isConnected}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all ${
              isChecking || !selectedTaskId || !task || !isConnected
                ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
            }`}
          >
            {isChecking ? "RUNNING ENGINE..." : "RUN VERIFICATION ENGINE"}
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {/* Verification Controls */}
        <section className="mb-8">
          <div className="glass-card p-8 mb-6">
            <div className="text-center mb-6">
              <p className="text-slate-400 text-sm mb-2 font-silkscreen tracking-[0.1em]">TASK VERIFICATION ENGINE</p>
              <p className="text-white/80">Connected to dedicated staged verifier pipeline and on-chain settlement</p>
            </div>

            <div className="max-w-xl mx-auto mb-6">
              <label className="block text-xs text-slate-400 mb-2 font-mono">SUBMITTED TASK</label>
              <select
                className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-4 py-3 text-sm text-white"
                value={selectedTaskId?.toString() || ""}
                onChange={(e) => {
                  setSelectedTaskId(e.target.value ? BigInt(e.target.value) : undefined);
                  setVerificationStatus("idle");
                  setVerificationResult(null);
                  setHasSubmittedDecision(false);
                }}
                disabled={submittedLoading || submittedTaskIds.length === 0}
              >
                {submittedTaskIds.length === 0 ? (
                  <option value="">No submitted tasks available</option>
                ) : (
                  submittedTaskIds.map((taskId) => (
                    <option key={taskId.toString()} value={taskId.toString()}>
                      Task #{taskId.toString().padStart(4, "0")}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex gap-4 justify-center mb-6">
              {verificationStatus === "processing" ? (
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-violet-500 mx-auto" />
              ) : (
                <button
                  onClick={handleVerify}
                  disabled={isChecking || !selectedTaskId || !task || !isConnected}
                  className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                    isChecking || !selectedTaskId || !task || !isConnected
                      ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
                  }`}
                >
                  {isChecking ? "RUNNING ENGINE..." : "VERIFY SELECTED TASK"}
                </button>
              )}
            </div>

            {/* Verification Result */}
            {verificationStatus !== "idle" && (
              <div className="mt-8 p-6 rounded-2xl border transition-all duration-300">
                {verificationStatus === "processing" ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-violet-500 mx-auto mb-4" />
                    <p className="text-slate-400 font-semibold">Running multi-stage verification pipeline...</p>
                  </div>
                ) : verificationStatus === "verified" && verificationResult && (
                  <div className="space-y-6">
                    {/* Overall Result */}
                    <div className="text-center">
                      <p className="text-sm text-slate-400 mb-2 font-mono">VERIFICATION RESULT</p>
                      <p className={`text-4xl font-bold ${verificationResult.success ? "text-green-400" : "text-red-400"}`}>
                        {verificationResult.success ? "PASS" : "FAIL"}
                      </p>
                      <p className="text-slate-600 text-sm mt-1">Score: {verificationResult.score}/100</p>
                      <p className="text-slate-500 text-xs mt-2">
                        Deterministic: {verificationResult.deterministicScore} | Qualitative: {verificationResult.llmScore}
                      </p>
                    </div>

                    {/* Criteria Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {verificationResult.criteria.map((criterion) => (
                        <div key={criterion.id} className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/5">
                          <p className="text-xs text-slate-400 mb-1 font-mono">
                            {criterion.id} | Stage {criterion.stage} | Weight {criterion.weight}
                          </p>
                          <p className="text-sm text-white/90">{criterion.label}</p>
                          <p className={`text-sm font-semibold mt-1 ${criterion.passed ? "text-green-400" : "text-red-400"}`}>
                            {criterion.passed ? "PASS" : "FAIL"}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{criterion.details}</p>
                        </div>
                      ))}
                    </div>

                    {/* Feedback and settlement controls */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 text-center">
                      <p className="text-blue-300 font-semibold text-sm mb-1">Engine Feedback</p>
                      <p className="text-white text-sm">{verificationResult.feedback}</p>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3">
                      <button
                        onClick={handleSubmitDecision}
                        disabled={
                          !isConnected ||
                          !verificationResult ||
                          isSubmittingOnChain ||
                          isVerifyingOnChain ||
                          isConfirmingVerify
                        }
                        className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                          !isConnected ||
                          !verificationResult ||
                          isSubmittingOnChain ||
                          isVerifyingOnChain ||
                          isConfirmingVerify
                            ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                            : "bg-emerald-600 text-white hover:bg-emerald-500"
                        }`}
                      >
                        {isSubmittingOnChain || isVerifyingOnChain || isConfirmingVerify
                          ? "Submitting Decision..."
                          : "Submit Verification Decision"}
                      </button>

                      <button
                        onClick={handleCreateReceipt}
                        disabled={!hasSubmittedDecision || isReceiptPending || isReceiptConfirming}
                        className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
                          !hasSubmittedDecision || isReceiptPending || isReceiptConfirming
                            ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                            : "bg-indigo-600 text-white hover:bg-indigo-500"
                        }`}
                      >
                        {isReceiptPending || isReceiptConfirming
                          ? "Creating Receipt..."
                          : "Create Verification Receipt"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Recent Verifications */}
        <section>
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-300">
            RECENT VERIFICATIONS
          </h2>

          <div className="space-y-4">
            {verificationHistory.length === 0 ? (
              <div className="glass-card p-6 border border-white/5 backdrop-blur-sm">
                <p className="text-slate-400 text-sm">No verification runs yet. Select a submitted task and run the engine.</p>
              </div>
            ) : (
              verificationHistory.map((history, index) => (
                <div key={index}>
                  <div className="glass-card p-6 border border-white/5 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400 font-semibold">Task {history.taskId}</p>
                        <p className="text-white font-mono text-xs">{history.timestamp}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold text-lg ${history.status === "PASS" ? "text-green-400" : "text-red-400"}`}>
                          {history.status}
                        </p>
                        <p className="text-sm text-slate-500">Score: {history.score}/100</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-xs text-slate-500">{history.feedback}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}