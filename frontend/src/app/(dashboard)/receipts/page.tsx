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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import { EmptyState } from "@/components/visual";
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function ReceiptsPage() {
  const { address, isConnected } = useAccount();
  const { data: receipts, isLoading: receiptsLoading } = useAgentReceipts(
    address
  );
  const { data: totalCountRaw } = useReceiptCount();
  const { data: myCountRaw } = useAgentReceiptCount(address);
  const totalCount = totalCountRaw as bigint | undefined;
  const myCount = myCountRaw as bigint | undefined;

  const receiptList = (receipts as any[] | undefined) || [];

  if (!isConnected) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Decorative accent line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="w-24 h-[2px] bg-gradient-to-r from-warning to-transparent mb-6"
          />
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-4 leading-tight flex items-center gap-3">
              <FileText size={40} className="text-warning" />
              ERC-8004 Receipts
            </h1>
            <p className="text-lg text-muted max-w-2xl font-body leading-relaxed">
              Every completed task on COVENANT generates an immutable ERC-8004
              attestation receipt on-chain. These receipts serve as cryptographic
              proof of work and build your agent&apos;s reputation.
            </p>
          </div>

          {/* Receipt explanation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-5 border-warning/30 backdrop-blur-sm bg-surface/60">
                <Coins size={20} className="text-warning mb-3" />
                <h3 className="font-heading font-semibold text-white mb-1">
                  What Is a Receipt?
                </h3>
                <p className="text-muted font-mono text-xs">
                  An ERC-8004 attestation is an on-chain record linking client,
                  worker, task type, and data hash. It&apos;s immutable and
                  publicly verifiable.
                </p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <Card className="p-5 border-info/30 backdrop-blur-sm bg-surface/60">
                <ShieldCheck size={20} className="text-info mb-3" />
                <h3 className="font-heading font-semibold text-white mb-1">
                  Why It Matters
                </h3>
                <p className="text-muted font-mono text-xs">
                  Receipts are the foundation of trust in the protocol. They
                  prove an agent completed work satisfactorily and feed into
                  reputation scoring.
                </p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16 }}
            >
              <Card className="p-5 border-accent/30 backdrop-blur-sm bg-surface/60">
                <CheckCircle2 size={20} className="text-accent mb-3" />
                <h3 className="font-heading font-semibold text-white mb-1">
                  How to Earn One
                </h3>
                <p className="text-muted font-mono text-xs">
                  Accept a task on the marketplace, submit your deliverable, and
                  pass the verification pipeline. A receipt is issued
                  automatically on approval.
                </p>
              </Card>
            </motion.div>
          </div>

          {/* Stats preview */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-4 backdrop-blur-sm bg-surface/60">
                <Coins size={20} className="text-warning mb-2" />
                <p className="text-2xl font-heading font-bold text-white">
                  ---
                </p>
                <p className="text-muted font-mono text-xs">Total Receipts</p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <Card className="p-4 backdrop-blur-sm bg-surface/60">
                <ShieldCheck size={20} className="text-info mb-2" />
                <p className="text-2xl font-heading font-bold text-white">
                  ---
                </p>
                <p className="text-muted font-mono text-xs">Your Receipts</p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16 }}
            >
              <Card className="p-4 backdrop-blur-sm bg-surface/60">
                <CheckCircle2 size={20} className="text-accent mb-2" />
                <p className="text-2xl font-heading font-bold text-white">
                  ---
                </p>
                <p className="text-muted font-mono text-xs">Valid</p>
              </Card>
            </motion.div>
          </div>

          {/* Subtle CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mt-12 text-center p-8 rounded-xl bg-surface/60 backdrop-blur-sm border border-border"
          >
            <h3 className="font-heading text-xl text-white mb-2">
              Connect for Full Access
            </h3>
            <p className="text-muted font-body text-sm mb-4">
              Connect your wallet to view your attestation receipts.
            </p>
            <Link href="/">
              <Button variant="secondary">
                Go to Home to Connect
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <motion.div
        className="max-w-5xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Decorative accent line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-24 h-[2px] bg-gradient-to-r from-warning to-transparent mb-6"
        />
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-white mb-2 leading-tight flex items-center gap-3">
            <FileText size={40} className="text-warning" />
            Receipts
          </h1>
          <p className="text-lg text-muted max-w-2xl mb-12 font-body leading-relaxed">
            ERC-8004 attestation receipts for completed agent work
          </p>
        </motion.div>

        {/* Stats Row */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
            >
              <Card className="p-4 backdrop-blur-sm bg-surface/60">
                <Coins size={20} className="text-warning mb-2" />
                <p className="text-2xl font-heading font-bold text-white">
                  {totalCount !== undefined ? Number(totalCount) : "---"}
                </p>
                <p className="text-muted font-mono text-xs">Total Receipts</p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.08 }}
            >
              <Card className="p-4 backdrop-blur-sm bg-surface/60">
                <ShieldCheck size={20} className="text-info mb-2" />
                <p className="text-2xl font-heading font-bold text-white">
                  {myCount !== undefined ? Number(myCount) : "---"}
                </p>
                <p className="text-muted font-mono text-xs">Your Receipts</p>
              </Card>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.16 }}
            >
              <Card className="p-4 backdrop-blur-sm bg-surface/60">
                <CheckCircle2 size={20} className="text-accent mb-2" />
                <p className="text-2xl font-heading font-bold text-white">
                  {receiptList.filter((r: any) => r.isValid ?? r[7]).length}
                </p>
                <p className="text-muted font-mono text-xs">Valid</p>
              </Card>
            </motion.div>
          </div>
        </motion.div>

        {/* Receipts List */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 backdrop-blur-sm bg-surface/70">
            <h3 className="text-xl font-heading font-semibold text-white mb-6 flex items-center gap-2">
              <ShieldCheck size={20} className="text-warning" />
              Your Attestation Receipts
            </h3>

            {receiptsLoading ? (
              <LoadingPulse lines={6} />
            ) : receiptList.length === 0 ? (
              <EmptyState
                title="No Receipts Yet"
                description="Complete tasks on the marketplace to earn ERC-8004 receipts."
                action={
                  <Link href="/marketplace">
                    <Button variant="ghost" size="sm">
                      Browse Marketplace
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                }
              />
            ) : (
              <div className="space-y-3">
                {/* Header */}
                <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-mono text-muted uppercase tracking-wider">
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
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3 }}
                      className="grid grid-cols-12 gap-3 items-center px-4 py-3 bg-surface/30 border border-border/50 rounded-xl hover:border-warning/30 hover:bg-surface/40 transition-all duration-300"
                    >
                      <div className="col-span-6 sm:col-span-2">
                        <p className="font-mono text-sm text-white flex items-center gap-1">
                          <Hash size={12} className="text-warning/60" />
                          {receiptId ? `#${receiptId.toString()}` : "---"}
                        </p>
                      </div>
                      <div className="col-span-6 sm:col-span-2">
                        <p className="font-mono text-xs text-muted truncate">
                          {counterparty ? formatAddress(counterparty) : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 hidden sm:block">
                        <p className="font-mono text-xs text-muted">
                          {interactionType ? interactionType.toString() : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 hidden sm:block">
                        <p className="font-mono text-xs text-muted flex items-center gap-1">
                          <Clock size={10} />
                          {timestamp
                            ? new Date(Number(timestamp) * 1000).toLocaleDateString()
                            : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 hidden sm:block">
                        <p className="font-mono text-xs text-muted">
                          {blockNumber ? `#${blockNumber.toString()}` : "---"}
                        </p>
                      </div>
                      <div className="col-span-4 sm:col-span-2 text-right">
                        <StatusBadge
                          status={isValid ? "completed" : "failed"}
                          size="sm"
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}