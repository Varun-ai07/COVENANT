"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { getContractAddresses } from "@/contracts/addresses";
import ReceiptVerifierABI from "@/contracts/ReceiptVerifier.json";

export default function ReceiptsPage() {
  const { address, isConnected, chain } = useAccount();
  const [searchAddress, setSearchAddress] = useState("");

  const contracts = chain ? getContractAddresses(chain.id) : getContractAddresses(84532);

  const { data: myReceipts, isLoading: myReceiptsLoading } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "getReceiptsByAgent",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: receiptCount } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "receiptCount",
  });

  const { data: searchedReceipts } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "getReceiptsByAgent",
    args: searchAddress && searchAddress.length === 42 ? [searchAddress as `0x${string}`] : undefined,
    query: { enabled: searchAddress.length === 42 },
  });

  const receiptIds = (searchAddress.length === 42 ? searchedReceipts : myReceipts) as string[] | undefined;

  const stats = [
    { label: "Total Receipts", value: receiptCount?.toString() || "0", color: "violet" },
    { label: "My Receipts", value: myReceipts ? (myReceipts as string[]).length : "0", color: "emerald" },
    { label: "Network", value: chain?.name || "Not Connected", color: "blue" },
  ];

  const colorClasses: Record<string, string> = {
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-silkscreen text-2xl text-white mb-2 tracking-[0.15em]">RECEIPT EXPLORER</h1>
        <p className="text-white/40 text-sm">View and verify ERC-8004 attestation receipts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 stagger-children">
        {stats.map((stat, i) => (
          <div key={i} className="glass-card p-5">
            <p className="text-slate-500 text-sm mb-2">{stat.label}</p>
            <p className={`text-2xl font-bold ${colorClasses[stat.color]}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="glass-card p-5 mb-8">
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="font-silkscreen text-xs tracking-[0.1em]">SEARCH RECEIPTS</span>
        </h2>
        <input
          type="text"
          value={searchAddress}
          onChange={(e) => setSearchAddress(e.target.value)}
          placeholder="Enter agent address (0x...)"
          className="input-glass w-full"
        />
      </div>

      {/* Receipts List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-silkscreen text-xs tracking-[0.1em]">{searchAddress.length === 42 ? "SEARCHED AGENT RECEIPTS" : "MY RECEIPTS"}</span>
        </h2>

        {!isConnected && !searchAddress ? (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-slate-400">Connect your wallet to view your receipts</p>
          </div>
        ) : myReceiptsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-5 shimmer">
                <div className="h-4 bg-white/5 rounded w-1/4 mb-3" />
                <div className="h-3 bg-white/5 rounded w-1/2 mb-2" />
                <div className="h-3 bg-white/5 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : receiptIds && receiptIds.length > 0 ? (
          <div className="space-y-4 stagger-children">
            {receiptIds.map((receiptId) => (
              <ReceiptCard key={receiptId} receiptId={receiptId} contracts={contracts} />
            ))}
          </div>
        ) : (
          <div className="glass-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-slate-400">No receipts found</p>
            <p className="text-slate-600 text-sm mt-1">Receipts are created when tasks are completed successfully</p>
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReceiptCard({ receiptId, contracts }: { receiptId: string; contracts: Record<string, any> }) {
  const { data: receiptData } = useReadContract({
    address: contracts.ReceiptVerifier as `0x${string}`,
    abi: ReceiptVerifierABI,
    functionName: "verifyReceipt",
    args: [receiptId],
  });

  if (!receiptData) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [isValid, receipt] = receiptData as [boolean, Record<string, any>];

  return (
    <div className="glass-card card-inner-glow p-5">
      <div className="flex justify-between items-start mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border ${
          isValid
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isValid ? "bg-emerald-400" : "bg-red-400"}`} />
          {isValid ? "Valid" : "Invalid"}
        </span>
        <span className="text-slate-500 text-sm flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {receipt.timestamp ? new Date(Number(receipt.timestamp) * 1000).toLocaleString() : "-"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Type</p>
          <p className="text-violet-400 text-sm font-medium">{receipt.interactionType}</p>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Block</p>
          <p className="text-slate-300 text-sm">{receipt.blockNumber?.toString()}</p>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Issuer</p>
          <p className="text-slate-300 text-sm font-mono">
            {receipt.issuer?.slice(0, 10)}...{receipt.issuer?.slice(-8)}
          </p>
        </div>
        <div className="bg-black/20 rounded-lg p-3 border border-white/5">
          <p className="text-slate-500 text-xs mb-1">Counterparty</p>
          <p className="text-slate-300 text-sm font-mono">
            {receipt.counterparty?.slice(0, 10)}...{receipt.counterparty?.slice(-8)}
          </p>
        </div>
      </div>

      <div className="bg-black/20 rounded-lg p-3 border border-white/5 mb-4">
        <p className="text-slate-500 text-xs mb-1">Data Hash</p>
        <p className="text-slate-400 text-xs font-mono truncate">{receipt.dataHash}</p>
      </div>

      <div className="pt-4 border-t border-white/5">
        <p className="text-slate-500 text-xs mb-1">Receipt ID</p>
        <p className="text-slate-500 text-xs font-mono truncate">{receiptId}</p>
      </div>
    </div>
  );
}
