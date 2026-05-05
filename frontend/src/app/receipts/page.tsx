"use client";

import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  FileText,
  LogIn,
  ArrowRight,
  Coins,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Hash,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  useAgentReceipts,
  useReceiptCount,
  useAgentReceiptCount,
} from "@/hooks/useReceipts";
import { formatAddress, formatEth } from "@/types";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function ReceiptsPage() {
  const { address, isConnected } = useAccount();
  const { data: receipts, isLoading: receiptsLoading } = useAgentReceipts(address);
  const { data: totalCountRaw } = useReceiptCount();
  const { data: myCountRaw } = useAgentReceiptCount(address);
  const totalCount = totalCountRaw as bigint | undefined;
  const myCount = myCountRaw as bigint | undefined;

  const receiptList = (receipts as any[] | undefined) || [];

  if (!isConnected) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-10 max-w-md text-center" glowColor="gold">
            <FileText size={48} className="text-neuron-gold mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              ERC-8004 Receipts
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to view your on-chain attestation receipts.
            </p>
            <Link href="/">
              <NeonButton variant="primary" size="lg">
                <LogIn size={18} />
                Go to Home
              </NeonButton>
            </Link>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen neural-bg py-8 px-4">
      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <FileText size={40} className="text-neuron-gold" />
            Receipts
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            ERC-8004 attestation receipts for completed agent work
          </p>
        </motion.div>

        {/* Stats Row */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <GlassCard className="p-4" glowColor="gold">
              <Coins size={20} className="text-neuron-gold mb-2" />
              <p className="text-2xl font-display font-bold text-white">
                {totalCount !== undefined ? Number(totalCount) : "---"}
              </p>
              <p className="text-gray-500 font-mono text-xs">Total Receipts</p>
            </GlassCard>
            <GlassCard className="p-4" glowColor="cyan">
              <ShieldCheck size={20} className="text-biolum-cyan mb-2" />
              <p className="text-2xl font-display font-bold text-white">
                {myCount !== undefined ? Number(myCount) : "---"}
              </p>
              <p className="text-gray-500 font-mono text-xs">Your Receipts</p>
            </GlassCard>
            <GlassCard className="p-4" glowColor="violet">
              <CheckCircle2 size={20} className="text-synapse-violet mb-2" />
              <p className="text-2xl font-display font-bold text-white">
                {receiptList.filter((r: any) => r.isValid ?? r[7]).length}
              </p>
              <p className="text-gray-500 font-mono text-xs">Valid</p>
            </GlassCard>
          </div>
        </motion.div>

        {/* Receipts List */}
        <motion.div variants={itemVariants}>
          <GlassCard className="p-6" glowColor="gold">
            <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
              <ShieldCheck size={20} className="text-neuron-gold" />
              Your Attestation Receipts
            </h3>

            {receiptsLoading ? (
              <LoadingPulse lines={6} />
            ) : receiptList.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={32} className="text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 font-body mb-4">
                  No receipts yet. Complete tasks on the marketplace to earn ERC-8004 receipts.
                </p>
                <Link href="/marketplace">
                  <NeonButton variant="ghost" size="sm">
                    Browse Marketplace
                    <ArrowRight size={14} />
                  </NeonButton>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-mono text-gray-600 uppercase tracking-wider">
                  <div className="col-span-2">Receipt</div>
                  <div className="col-span-2">Counterparty</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Block</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {receiptList.map((receipt: any, idx: number) => {
                  const receiptId = receipt.receiptId ?? receipt[0];
                  const issuer = receipt.issuer ?? receipt[1];
                  const counterparty = receipt.counterparty ?? receipt[2];
                  const interactionType = receipt.interactionType ?? receipt[3];
                  const timestamp = receipt.timestamp ?? receipt[5];
                  const blockNumber = receipt.blockNumber ?? receipt[6];
                  const isValid = receipt.isValid ?? receipt[7];

                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-3 items-center px-4 py-3 bg-glass/30 border border-glass-border rounded-xl hover:border-neuron-gold/30 transition-colors"
                    >
                      <div className="col-span-6 sm:col-span-2">
                        <p className="font-mono text-sm text-white flex items-center gap-1">
                          <Hash size={12} className="text-neuron-gold/60" />
                          {receiptId ? `#${receiptId.toString()}` : "---"}
                        </p>
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <p className="font-mono text-xs text-gray-400 truncate">
                          {counterparty ? formatAddress(counterparty) : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 hidden sm:block">
                        <p className="font-mono text-xs text-gray-400">
                          {interactionType ? interactionType.toString() : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 hidden sm:block">
                        <p className="font-mono text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {timestamp
                            ? new Date(Number(timestamp) * 1000).toLocaleDateString()
                            : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 hidden sm:block">
                        <p className="font-mono text-xs text-gray-500">
                          {blockNumber ? `#${blockNumber.toString()}` : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 text-right">
                        <StatusBadge
                          status={isValid ? "completed" : "failed"}
                          size="sm"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
