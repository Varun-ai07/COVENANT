"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { getContractAddresses } from "@/contracts/addresses";
import OpenTaskMarketABI from "@/contracts/OpenTaskMarket.json";
import { useToast } from "@/components/Toast";

export interface OpenTask {
  taskId: bigint;
  client: string;
  maxPayment: bigint;
  deadline: bigint;
  descriptionHash: string;
  bidders: string[];
  selectedWorker: string;
  status: number; // 0=Open, 1=Selected, 2=Completed, 3=Cancelled
  postedAt: bigint;
}

export interface Bid {
  price: bigint;
  timeEstimate: number;
  proposal: string;
  bidAt: bigint;
  bidder: string;
  hasCounter: boolean;
  counterPrice: bigint;
  counterTimeEstimate: number;
  counterProposalHash: string;
  counterAccepted: boolean;
}

export function useOpenTaskMarket() {
  const { chain } = useAccount();
  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  // Read: Get task counter
  const { data: taskCounter, refetch: refetchCounter } = useReadContract({
    address: contracts.OpenTaskMarket as `0x${string}`,
    abi: OpenTaskMarketABI,
    functionName: "taskCounter",
  });

  // Read: Get specific task
  const useTask = (taskId: bigint | undefined) => {
    const { data: taskData, isLoading, refetch } = useReadContract({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "getTask",
      args: taskId !== undefined ? [taskId] : undefined,
      query: { enabled: taskId !== undefined },
    });

    // Parse task data (tuple decoding)
    const parseTask = (data: any): OpenTask => ({
      taskId: data[0] || taskId,
      client: data[1],
      maxPayment: data[2],
      deadline: data[3],
      descriptionHash: data[4],
      bidders: data[5] || [],
      selectedWorker: data[6],
      status: Number(data[7]),
      postedAt: data[8],
    });

    return {
      task: taskData ? parseTask(taskData) : undefined,
      isLoading,
      refetch,
    };
  };

  // Read: Get bid for a task/bidder
  const useBid = (taskId: bigint | undefined, bidder: string | undefined) => {
    const { data: bidData, isLoading, refetch } = useReadContract({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "getBid",
      args: taskId && bidder ? [taskId, bidder] : undefined,
      query: { enabled: !!taskId && !!bidder },
    });

    const parseBid = (data: any, bidderAddr: string): Bid => ({
      price: data[0],
      timeEstimate: Number(data[1]),
      proposal: data[2],
      bidAt: data[3],
      bidder: bidderAddr,
      hasCounter: data[4] || false,
      counterPrice: data[5] || 0n,
      counterTimeEstimate: Number(data[6] || 0),
      counterProposalHash: data[7] || "0x",
      counterAccepted: data[8] || false,
    });

    return {
      bid: bidData ? parseBid(bidData, bidder) : undefined,
      isLoading,
      refetch,
    };
  };

  // Write: Create open task
  const { writeContract: writeCreateOpenTask, data: createHash, isPending: isCreating, error: createError } = useWriteContract();
  const { isLoading: isConfirmingCreate, isSuccess: isCreateSuccess } = useWaitForTransactionReceipt({ hash: createHash });
  const { addToast } = useToast();

  const createOpenTask = (maxPayment: string, deadline: bigint, descriptionHash: string) => {
    const paymentWei = parseEther(maxPayment);
    writeCreateOpenTask({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "createOpenTask",
      args: [paymentWei, deadline, descriptionHash],
      value: paymentWei,
    });
    addToast({ type: "info", title: "Posting Task", message: "Creating open task on marketplace..." });
  };

  // Write: Submit bid
  const { writeContract: writeSubmitBid, data: bidHash, isPending: isBidding, error: bidError } = useWriteContract();
  const { isLoading: isConfirmingBid, isSuccess: isBidSuccess } = useWaitForTransactionReceipt({ hash: bidHash });

  const submitBid = (taskId: bigint, price: string, timeEstimate: number, proposalHash: string) => {
    const priceWei = parseEther(price);
    writeSubmitBid({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "submitBid",
      args: [taskId, priceWei, timeEstimate, proposalHash],
    });
  };

  // Write: Select worker
  const { writeContract: writeSelectWorker, data: selectHash, isPending: isSelecting, error: selectError } = useWriteContract();
  const { isLoading: isConfirmingSelect, isSuccess: isSelectSuccess } = useWaitForTransactionReceipt({ hash: selectHash });

  const selectWorker = (taskId: bigint, workerAddress: string) => {
    writeSelectWorker({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "selectWorker",
      args: [taskId, workerAddress],
    });
  };

  // Write: Make counter-offer (client)
  const { writeContract: writeCounterOffer, data: counterHash, isPending: isCounterOffering, error: counterError } = useWriteContract();
  const { isLoading: isConfirmingCounter, isSuccess: isCounterSuccess } = useWaitForTransactionReceipt({ hash: counterHash });

  const makeCounterOffer = (taskId: bigint, bidder: string, counterPrice: string, counterTimeEstimate: number, counterProposalHash: string) => {
    const priceWei = parseEther(counterPrice);
    writeCounterOffer({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "makeCounterOffer",
      args: [taskId, bidder, priceWei, counterTimeEstimate, counterProposalHash],
    });
  };

  // Write: Accept/Reject counter-offer (worker/bidder)
  const { writeContract: writeAcceptCounter, data: acceptHash, isPending: isAccepting, error: acceptError } = useWriteContract();
  const { isLoading: isConfirmingAccept, isSuccess: isAcceptSuccess } = useWaitForTransactionReceipt({ hash: acceptHash });

  const acceptCounterOffer = (taskId: bigint) => {
    writeAcceptCounter({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "acceptCounterOffer",
      args: [taskId],
    });
  };

  const { writeContract: writeRejectCounter, data: rejectHash, isPending: isRejecting, error: rejectError } = useWriteContract();
  const { isLoading: isConfirmingReject, isSuccess: isRejectSuccess } = useWaitForTransactionReceipt({ hash: rejectHash });

  const rejectCounterOffer = (taskId: bigint) => {
    writeRejectCounter({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "rejectCounterOffer",
      args: [taskId],
    });
  };

  // Write: Withdraw bid
  const { writeContract: writeWithdrawBid, data: withdrawHash, isPending: isWithdrawing, error: withdrawError } = useWriteContract();
  const { isLoading: isConfirmingWithdraw, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  const withdrawBid = (taskId: bigint) => {
    writeWithdrawBid({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      functionName: "withdrawBid",
      args: [taskId],
    });
  };

  // Event watching
  const { useWatchContractEvent } = require("wagmi");

  const useWatchOpenTask = (onOpenTask?: (taskId: number) => void) => {
    useWatchContractEvent({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      eventName: "TaskPosted",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { taskId: bigint };
          onOpenTask?.(Number(args.taskId));
        }
      },
    });
  };

  const useWatchBidSubmitted = (onBid?: (taskId: number, bidder: string) => void) => {
    useWatchContractEvent({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      eventName: "BidSubmitted",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { taskId: bigint; bidder: string };
          onBid?.(Number(args.taskId), args.bidder);
        }
      },
    });
  };

  const useWatchWorkerSelected = (onSelect?: (taskId: number, worker: string) => void) => {
    useWatchContractEvent({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      eventName: "WorkerSelected",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { taskId: bigint; worker: string };
          onSelect?.(Number(args.taskId), args.worker);
        }
      },
    });
  };

  const useWatchCounterOffer = (onCounterOffer?: (taskId: number, bidder: string) => void) => {
    useWatchContractEvent({
      address: contracts.OpenTaskMarket as `0x${string}`,
      abi: OpenTaskMarketABI,
      eventName: "CounterOfferMade",
      onLogs(logs) {
        for (const log of logs as any[]) {
          const args = log.args as { taskId: bigint; bidder: string };
          onCounterOffer?.(Number(args.taskId), args.bidder);
        }
      },
    });
  };

  return {
    // State
    taskCounter,
    useTask,
    useBid,
    // Mutations
    createOpenTask,
    submitBid,
    selectWorker,
    makeCounterOffer,
    acceptCounterOffer,
    rejectCounterOffer,
    withdrawBid,
    // Status
    isCreating,
    isConfirmingCreate,
    isCreateSuccess,
    createError,
    isBidding,
    isConfirmingBid,
    isBidSuccess,
    bidError,
    isSelecting,
    isConfirmingSelect,
    isSelectSuccess: isSelectSuccess,
    selectError,
    // Events
    useWatchOpenTask,
    useWatchBidSubmitted,
    useWatchWorkerSelected,
    useWatchCounterOffer,
  };
}
