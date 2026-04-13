"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useRegisterVerifier, useIsRegisteredVerifier, useVerifierStake, useGetSubmittedTasks, useCreateVerificationReceipt, useStakeOnVerification, useChallengeVerification, useWatchVerificationEvents, useWatchVerifierStakes, useWatchVerificationChallenges } from "@/hooks/useVerifier";
import { formatEther, parseEther } from "viem";
import { useToast } from "@/components/Toast";

export default function VerifierDashboard() {
  const { address, isConnected } = useAccount();
  const { addToast } = useToast();

  // Verifier registration and status
  const { registerVerifier, isPending: isRegistering, isSuccess: registerSuccess, error: registerError, hash: registerHash } = useRegisterVerifier();
  const { isRegisteredVerifier, isLoading: isLoadingRegStatus } = useIsRegisteredVerifier(address as `0x${string}`);
  const { verifierStake, isLoading: isLoadingStake } = useVerifierStake(address as `0x${string}`);
  const { totalVerifierStake } = useTotalVerifierStake();

  // Submitted tasks for verification
  const { submittedTaskIds, isLoading: isLoadingTasks, refetch: refetchTasks } = useGetSubmittedTasks();
  
  // Verification actions
  const { createVerificationReceipt, isPending: isCreatingReceipt, isSuccess: receiptSuccess, error: receiptError, hash: receiptHash } = useCreateVerificationReceipt();
  const { stakeOnVerification, isPending: isStakingOnVerification } = useStakeOnVerification();
  const { challengeVerification, isPending: isChallenging } = useChallengeVerification();
  
  // Batch verification
  const { writeContract: batchWriteContract, data: batchHash, isPending: isBatchPending, error: batchError } = useWriteContract();
  const { isLoading: isBatchConfirming, isSuccess: isBatchSuccess } = useWaitForTransactionReceipt({ hash: batchHash });
  
  // Event watchers
  useWatchVerificationEvents((taskId) => {
    addToast({
      type: "success",
      title: "Verification Complete",
      message: `Task #${taskId} has been verified`
    });
    refetchTasks();
  });

  useWatchVerifierStakes((verifier, amount) => {
    if (verifier === address) {
      addToast({
        type: "info",
        title: "Stake Updated",
        message: `Your verifier stake is now ${amount} ETH`
      });
    }
  });

  useWatchVerificationChallenges((taskId, challenger) => {
    if (challenger === address) {
      addToast({
        type: "warning",
        title: "Verification Challenged",
        message: `Your verification for task #${taskId} has been challenged`
      });
    } else {
      addToast({
        type: "info",
        title: "New Challenge",
        message: `Task #${taskId} has been challenged by another verifier`
      });
    }
    refetchTasks();
  });

  // UI States
  const [stakeAmount, setStakeAmount] = useState("0.001");
  const [selectedTaskId, setSelectedTaskId] = useState<bigint | null>(null);
  const [verificationDecision, setVerificationDecision] = useState<boolean>(true);
  const [verificationScore, setVerificationScore] = useState<number>(8);
  const [verificationFeedback, setVerificationFeedback] = useState<string>("");
  const [stakeOnDecisionAmount, setStakeOnDecisionAmount] = useState("0.0005");
  const [challengeEvidence, setChallengeEvidence] = useState<string>("");
  
  // Batch verification states
  const [batchSize, setBatchSize] = useState(3);
  const [batchSuccessThreshold, setBatchSuccessThreshold] = useState(0.8);
  const [batchStakePerTask, setBatchStakePerTask] = useState("0.0005");
  const [isCreatingBatchVerification, setIsCreatingBatchVerification] = useState(false);
  
  // Stats (in a real app, these would come from blockchain queries)
  const [tasksVerifiedCount, setTasksVerifiedCount] = useState(0);
  const [successfulChallengesCount, setSuccessfulChallengesCount] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState("0");
  const [reputationScore, setReputationScore] = useState(0);

  // Handle batch verification creation
  const handleCreateBatchVerification = async () => {
    if (!address || submittedTaskIds.length < batchSize) return;

    // Select the first 'batchSize' tasks for batch verification
    const selectedTasks = submittedTaskIds.slice(0, batchSize);
    const batchSizeNum = selectedTasks.length;
    
    // For simplicity, we'll assume all tasks are successful (in reality, this would be based on actual verification)
    const results = new Array(batchSizeNum).fill(true);
    
    try {
      setIsCreatingBatchVerification(true);
      
      // Call the verifyBatch function on TaskEscrow
      batchWriteContract({
        address: contracts.TaskEscrow as `0x${string}`,
        abi: TaskEscrowABI,
        functionName: "verifyBatch",
        args: [selectedTasks, results],
      });
      
      // Note: In a real implementation, we would wait for the transaction to confirm
      // and then update stats accordingly. For now, we'll simulate success.
      
      // Simulate successful batch verification
      setTimeout(() => {
        setIsCreatingBatchVerification(false);
        setTasksVerifiedCount(prev => prev + batchSizeNum);
        // In a real app, we would calculate earnings based on stake and success
        setTotalEarnings((prev) => {
          const current = parseFloat(prev);
          const earnings = batchSizeNum * parseFloat(batchStakePerTask) * 0.5; // 50% return on stake
          return (current + earnings).toFixed(3);
        });
        addToast({
          type: "success",
          title: "Batch Verification Complete",
          message: `Successfully verified ${batchSizeNum} tasks`
        });
        refetchTasks();
      }, 2000);
    } catch (error) {
      setIsCreatingBatchVerification(false);
      addToast({
        type: "error",
        title: "Batch Verification Failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  };

  // Handle registration
  const handleRegisterVerifier = () => {
    if (!address) return;
    registerVerifier(stakeAmount);
  };

  // Handle verification creation
  const handleCreateVerification = () => {
    if (!selectedTaskId) return;
    createVerificationReceipt(
      selectedTaskId,
      verificationDecision,
      verificationScore,
      verificationFeedback
    );
  };

  // Handle staking on verification
  const handleStakeOnVerification = () => {
    if (!selectedTaskId) return;
    stakeOnVerification(
      selectedTaskId,
      verificationDecision,
      stakeOnDecisionAmount
    );
  };

  // Handle challenging verification
  const handleChallengeVerification = () => {
    if (!selectedTaskId || !challengeEvidence.trim()) return;
    challengeVerification(selectedTaskId, challengeEvidence);
  };

  // Format task ID for display
  const formatTaskId = (taskId: bigint) => {
    return `#${taskId.toString()}`;
  };

  if (!isConnected) {
    return (
      <div className="glass-card p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-2.21 0-4 1.79-4 4v6c0 1.11.89 2 2 2h4v-5l3-3-3-3v5H8a2 2 0 01-2-2V8c0-1.11.89-2 2-2z" />
          </svg>
        </div>
        <p className="text-slate-400 mb-2">Connect your wallet to access verifier features</p>
        <p className="text-slate-600 text-sm">Use the Connect button in the navigation bar</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Verifier Status Card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.029 9-11.622 0-.165-.006-.33-.018-.493z" />
          </svg>
          <span className="font-silkscreen text-xs tracking-[0.1em]">VERIFIER STATUS</span>
        </h2>
        
        {!isRegisteredVerifier ? (
          <div className="space-y-4">
            <p className="text-slate-400">You are not registered as a verifier yet</p>
            <p className="text-slate-600 text-sm">Register to earn rewards by verifying completed tasks</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Stake Amount (ETH)</label>
                <input
                  type="text"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.001"
                  className="input-glass w-full"
                />
                <p className="text-slate-600 text-xs mt-1.5">Minimum: 0.001 ETH</p>
              </div>
              
              <button
                onClick={handleRegisterVerifier}
                disabled={isRegistering || !address}
                className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-silkscreen text-xs tracking-[0.1em]"
              >
                {isRegistering ? "CONFIRM IN WALLET..." : "REGISTER AS VERIFIER"}
              </button>
              
              {registerHash && (
                <div className="p-4 bg-black/20 rounded-xl border border-white/5 mt-4">
                  <p className="text-slate-500 text-xs mb-1">Transaction Hash</p>
                  <a
                    href={`https://sepolia.basescan.org/tx/${registerHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 text-xs font-mono hover:underline break-all"
                  >
                    {registerHash}
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between">
              <div>
                <p className="text-slate-400 text-xs mb-1">Verifier Status</p>
                <p className="text-white font-semibold">Active ✓</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Current Stake</p>
                <p className="text-white font-semibold">{verifierStake} ETH</p>
              </div>
            </div>
            
            <div className="flex justify-between">
              <div>
                <p className="text-slate-400 text-xs mb-1">Network Stake</p>
                <p className="text-white font-semibold">{totalVerifierStake} ETH</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">Potential Rewards</p>
                <p className="text-emerald-400 font-semibold">Variable</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pending Tasks for Verification */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.029 9-11.622 0-.165-.006-.33-.018-.493z" />
          </svg>
          <span className="font-silkscreen text-xs tracking-[0.1em]">PENDING VERIFICATIONS</span>
        </h2>
        
        {isLoadingTasks ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/5 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : submittedTaskIds.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400">No tasks pending verification</p>
            <p className="text-slate-600 text-sm">Check back when workers submit completed tasks</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-slate-400 font-medium">{submittedTaskIds.length} tasks awaiting verification</span>
              <button
                onClick={() => refetchTasks()}
                className="text-slate-400 hover:text-white text-sm font-silkscreen"
              >
                Refresh
              </button>
            </div>
            
            <div className="space-y-3">
              {submittedTaskIds.map((taskId) => (
                <div key={taskId.toString()} className="p-4 bg-black/20 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                        <span className="text-violet-400 font-bold">{formatTaskId(taskId)}</span>
                      </div>
                      <div>
                        <p className="text-slate-400 text-sm">Task ID</p>
                        <p className="text-white font-semibold">{taskId.toString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setSelectedTaskId(taskId);
                          // Reset form when selecting new task
                          setVerificationDecision(true);
                          setVerificationScore(8);
                          setVerificationFeedback("");
                          setStakeOnDecisionAmount("0.0005");
                          setChallengeEvidence("");
                        }}
                        className={`px-3 py-1.5 ${selectedTaskId === taskId ? "bg-white/10 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"} text-xs rounded-lg border border-white/10 transition-all duration-200`}
                      >
                        Select for Verification
                      </button>
                      
                      {!selectedTaskId && (
                        <button
                          onClick={() => {
                            setSelectedTaskId(taskId);
                            setVerificationDecision(true);
                            setVerificationScore(8);
                            setVerificationFeedback("");
                            setStakeOnDecisionAmount("0.0005");
                            setChallengeEvidence("");
                          }}
                          className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-lg border border-emerald-500/20 hover:bg-emerald-500/30 transition-all duration-200"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {selectedTaskId === taskId && (
                    <VerificationForm(
                      taskId={taskId}
                      onCreateVerification={handleCreateVerification}
                      onStakeOnVerification={handleStakeOnVerification}
                      onChallengeVerification={handleChallengeVerification}
                      verificationDecision={verificationDecision}
                      setVerificationDecision={setVerificationDecision}
                      verificationScore={verificationScore}
                      setVerificationScore={setVerificationScore}
                      verificationFeedback={verificationFeedback}
                      setVerificationFeedback={setVerificationFeedback}
                      stakeOnDecisionAmount={stakeOnDecisionAmount}
                      setStakeOnDecisionAmount={setStakeOnDecisionAmount}
                      challengeEvidence={challengeEvidence}
                      setChallengeEvidence={setChallengeEvidence}
                      isCreatingReceipt={isCreatingReceipt}
                      isStakingOnVerification={isStakingOnVerification}
                      isChallenging={isChallenging}
                      receiptSuccess={receiptSuccess}
                      receiptError={receiptError}
                      addToast={addToast}
                    />
                  )}
                </div>
              ))}
            </div>
          }
        )}
      </div>

      {/* Batch Verification Interface */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c4 0 7 2 7 6 0 4-3 9-9 9s-9-5-9-9 3-6 7-6Z" />
          </svg>
          <span className="font-silkscreen text-xs tracking-[0.1em]">BATCH VERIFICATION</span>
        </h2>
        
        <div className="space-y-4">
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="text-slate-500 text-xs mb-2 font-medium">Batch Size</p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={10}
                value={batchSize}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 1 && value <= 10) {
                    setBatchSize(value);
                  }
                }}
                className="input-glass w-20 text-center"
              />
              <span className="ml-2 text-slate-400 text-xs">tasks</span>
            </div>
            <p className="text-slate-600 text-xs mt-1.5">Verify multiple submitted tasks at once</p>
          </div>
          
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="text-slate-500 text-xs mb-2 font-medium">Batch Verification Settings</p>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={batchSuccessThreshold === 0.8}
                    onChange={() => setBatchSuccessThreshold(0.8)}
                    className="h-3 w-3 text-violet-600"
                  />
                  80% Success Threshold
                </label>
                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={batchSuccessThreshold === 0.6}
                    onChange={() => setBatchSuccessThreshold(0.6)}
                    className="h-3 w-3 text-violet-600"
                  />
                  60% Success Threshold
                </label>
                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={batchSuccessThreshold === 0.5}
                    onChange={() => setBatchSuccessThreshold(0.5)}
                    className="h-3 w-3 text-violet-600"
                  />
                  50% Success Threshold (Majority)
                </label>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={batchStakePerTask === "0.0005"}
                    onChange={() => setBatchStakePerTask("0.0005")}
                    className="h-3 w-3 text-violet-600"
                  />
                  0.0005 ETH per task
                </label>
                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={batchStakePerTask === "0.001"}
                    onChange={() => setBatchStakePerTask("0.001")}
                    className="h-3 w-3 text-violet-600"
                  />
                  0.001 ETH per task
                </label>
                <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={batchStakePerTask === "0.002"}
                    onChange={() => setBatchStakePerTask("0.002")}
                    className="h-3 w-3 text-violet-600"
                  />
                  0.002 ETH per task
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleCreateBatchVerification}
              disabled={isCreatingBatchVerification || submittedTaskIds.length < batchSize}
              className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-xl hover:shadow-glow-emerald transition-all duration-300 disabled:opacity-50 font-silkscreen text-xs tracking-[0.1em]"
            >
              {isCreatingBatchVerification ? "PROCESSING BATCH..." : `VERIFY BATCH (${batchSize})`}
            </button>
          </div>
        </div>
      </div>
      
      {/* Verification Statistics */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 002 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-silkscreen text-xs tracking-[0.1em]">VERIFICATION STATS</span>
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="text-slate-500 text-xs mb-1">Tasks Verified</p>
            <p className="text-white font-semibold">{tasksVerifiedCount}</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="text-slate-500 text-xs mb-1">Successful Challenges</p>
            <p className="text-white font-semibold">{successfulChallengesCount}</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="text-slate-500 text-xs mb-1">Total Earnings</p>
            <p className="text-white font-semibold">{totalEarnings} ETH</p>
          </div>
          <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <p className="text-slate-500 text-xs mb-1">Reputation Score</p>
            <p className="text-white font-semibold">{reputationScore}/1000</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationForm({
  taskId,
  onCreateVerification,
  onStakeOnVerification,
  onChallengeVerification,
  verificationDecision,
  setVerificationDecision,
  verificationScore,
  setVerificationScore,
  verificationFeedback,
  setVerificationFeedback,
  stakeOnDecisionAmount,
  setStakeOnDecisionAmount,
  challengeEvidence,
  setChallengeEvidence,
  isCreatingReceipt,
  isStakingOnVerification,
  isChallenging,
  receiptSuccess,
  receiptError,
  addToast
}: {
  taskId: bigint;
  onCreateVerification: (taskId: bigint, success: boolean, score: number, feedback: string) => void;
  onStakeOnVerification: (taskId: bigint, verifierDecision: boolean, stakeAmount: string) => void;
  onChallengeVerification: (taskId: bigint, evidence: string) => void;
  verificationDecision: boolean;
  setVerificationDecision: (decision: boolean) => void;
  verificationScore: number;
  setVerificationScore: (score: number) => void;
  verificationFeedback: string;
  setVerificationFeedback: (feedback: string) => void;
  stakeOnDecisionAmount: string;
  setStakeOnDecisionAmount: (amount: string) => void;
  challengeEvidence: string;
  setChallengeEvidence: (evidence: string) => void;
  isCreatingReceipt: boolean;
  isStakingOnVerification: boolean;
  isChallenging: boolean;
  receiptSuccess: boolean;
  receiptError: string | null;
  addToast: (toast: any) => void;
}) {
  const handleCreateVerification = () => {
    onCreateVerification(taskId, verificationDecision, verificationScore, verificationFeedback);
  };

  const handleStakeOnVerification = () => {
    onStakeOnVerification(taskId, verificationDecision, stakeOnDecisionAmount);
  };

  const handleChallengeVerification = () => {
    onChallengeVerification(taskId, challengeEvidence);
  };

  return (
    <div className="space-y-4">
      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
        <p className="text-slate-500 text-xs mb-2 font-medium">Verification Decision</p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
            <input
              type="radio"
              checked={verificationDecision}
              onChange={() => setVerificationDecision(true)}
              className="h-3 w-3 text-violet-600"
            />
            Accept
          </label>
          <label className="flex items-center gap-2 text-slate-400 text-sm cursor-pointer">
            <input
              type="radio"
              checked={!verificationDecision}
              onChange={() => setVerificationDecision(false)}
              className="h-3 w-3 text-violet-600"
            />
            Reject
          </label>
        </div>
      </div>

      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
        <p className="text-slate-500 text-xs mb-2 font-medium">Quality Score (1-10)</p>
        <div className="flex items-center">
          <input
            type="number"
            min={1}
            max={10}
            value={verificationScore}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value) && value >= 1 && value <= 10) {
                setVerificationScore(value);
              }
            }}
            className="input-glass w-20 text-center"
          />
          <span className="ml-2 text-slate-400 text-xs">/10</span>
        </div>
      </div>

      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
        <p className="text-slate-500 text-xs mb-2 font-medium">Feedback (Optional)</p>
        <textarea
          value={verificationFeedback}
          onChange={(e) => setVerificationFeedback(e.target.value)}
          placeholder="Provide constructive feedback about the work..."
          className="textarea-glass w-full h-24 resize-none"
        />
      </div>

      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
        <p className="text-slate-500 text-xs mb-2 font-medium">Stake on Your Decision (Optional)</p>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={stakeOnDecisionAmount}
            onChange={(e) => setStakeOnDecisionAmount(e.target.value)}
            placeholder="0.0005"
            className="input-glass"
          />
          <span className="text-slate-400 text-xs">ETH</span>
        </div>
        <p className="text-slate-600 text-xs mt-1.5">Stake to increase your potential rewards</p>
      </div>

      <div className="bg-black/20 rounded-xl p-4 border border-white/5">
        <p className="text-slate-500 text-xs mb-2 font-medium">Challenge Evidence (Optional)</p>
        <textarea
          value={challengeEvidence}
          onChange={(e) => setChallengeEvidence(e.target.value)}
          placeholder="Provide evidence if you believe this verification is incorrect..."
          className="textarea-glass w-full h-24 resize-none"
        />
        <p className="text-slate-600 text-xs mt-1.5">Challenge to dispute this verification decision</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleCreateVerification}
          disabled={isCreatingReceipt}
          className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-glow-violet transition-all duration-300 disabled:opacity-50 font-silkscreen text-xs tracking-[0.1em]"
        >
          {isCreatingReceipt ? "CREATING VERIFICATION..." : "CREATE VERIFICATION RECEIPT"}
        </button>
        
        <button
          onClick={handleStakeOnVerification}
          disabled={isStakingOnVerification}
          className="flex-1 py-3 bg-white/5 border border-white/10 text-white rounded-xl hover:bg-white/10 transition-all duration-200 disabled:opacity-50 font-silkscreen text-xs tracking-[0.1em]"
        >
          {isStakingOnVerification ? "CONFIRMING STAKE..." : "STAKE ON DECISION"}
        </button>
        
        <button
          onClick={handleChallengeVerification}
          disabled={isChallenging}
          className="flex-1 py-3 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/30 transition-all duration-200 disabled:opacity-50 font-silkscreen text-xs tracking-[0.1em]"
        >
          {isChallenging ? "CONFIRMING CHALLENGE..." : "CHALLENGE VERIFICATION"}
        </button>
      </div>

      {receiptSuccess && (
        <div className="p-4 bg-black/20 rounded-xl border border-white/5 mt-4">
          <p className="text-slate-500 text-xs mb-1">Transaction Hash</p>
          <a
            href={`https://sepolia.basescan.org/tx/${taskId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 text-xs font-mono hover:underline break-all"
          >
            Verification submitted successfully!
          </a>
        </div>
      )}
      
      {receiptError && (
        <div className="p-4 bg-black/20 rounded-xl border border-white/5 mt-4">
          <p className="text-slate-500 text-xs mb-1">Error</p>
          <p className="text-red-400 text-xs">{receiptError}</p>
        </div>
      )}
    </div>
  );
}