"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import Link from "next/link";
import {
  ShieldCheck,
  LogIn,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  UserPlus,
  UserMinus,
  Key,
  AlertTriangle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { LoadingPulse } from "@/components/ui/LoadingPulse";
import {
  useIsAuthorizedIssuer,
  useAddAuthorizedIssuer,
  useRemoveAuthorizedIssuer,
  useVerifyCapabilityProof,
} from "@/hooks/useCapabilityVerifier";
import { formatAddress } from "@/types";
import type { Address } from "viem";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function VerifierPage() {
  const { address, isConnected } = useAccount();
  const [issuerAddress, setIssuerAddress] = useState("");
  const [checkAddress, setCheckAddress] = useState("");

  const { isAuthorized, isLoading: checkLoading } = useIsAuthorizedIssuer(
    checkAddress as Address || undefined
  );
  const { addIssuer, isPending: isAdding, hash: addHash } = useAddAuthorizedIssuer();
  const { removeIssuer, isPending: isRemoving, hash: removeHash } = useRemoveAuthorizedIssuer();
  const addConfirmed = !!addHash;
  const removeConfirmed = !!removeHash;

  const handleAddIssuer = () => {
    if (!issuerAddress) return;
    addIssuer(issuerAddress as Address);
  };

  const handleRemoveIssuer = () => {
    if (!issuerAddress) return;
    removeIssuer(issuerAddress as Address);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen neural-bg flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard className="p-10 max-w-md text-center" glowColor="cyan">
            <ShieldCheck size={48} className="text-biolum-cyan mx-auto mb-4" />
            <h2 className="text-2xl font-display font-bold text-white mb-2">
              Capability Verifier
            </h2>
            <p className="text-gray-400 font-body mb-6">
              Connect your wallet to manage authorized issuers and verify capability proofs.
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
        className="max-w-4xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-2 flex items-center gap-3">
            <ShieldCheck size={40} className="text-biolum-cyan" />
            Capability Verifier
          </h1>
          <p className="text-gray-400 font-mono text-sm">
            Zero-knowledge capability verification for agent authorization
          </p>
        </motion.div>

        {/* Info Card */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="cyan">
            <div className="flex items-start gap-4">
              <Key size={24} className="text-biolum-cyan flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-display font-semibold text-white mb-2">
                  How It Works
                </h3>
                <p className="text-gray-400 font-body text-sm leading-relaxed">
                  The CapabilityVerifier uses zero-knowledge proofs to verify agent capabilities without
                  revealing sensitive data. Authorized issuers can submit ZK proofs that attest to an
                  agent&apos;s abilities. The contract verifies the proof on-chain and records the attestation.
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* Check Issuer Status */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="violet">
            <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
              <ShieldCheck size={20} className="text-synapse-violet" />
              Check Issuer Authorization
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={checkAddress}
                onChange={(e) => setCheckAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 p-3 bg-glass border border-glass-border rounded-xl font-mono text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-synapse-violet/50"
              />
              <NeonButton
                variant="secondary"
                size="sm"
                onClick={() => {}} // The hook auto-fetches on checkAddress change
              >
                Check
              </NeonButton>
            </div>

            {checkAddress && checkAddress.length === 42 && (
              <div className="mt-4 p-4 bg-glass/30 rounded-xl border border-glass-border">
                {checkLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-gray-500" />
                    <span className="text-gray-500 font-mono text-sm">Checking...</span>
                  </div>
                ) : isAuthorized !== undefined ? (
                  <div className="flex items-center gap-2">
                    {isAuthorized ? (
                      <>
                        <CheckCircle2 size={18} className="text-green-400" />
                        <span className="text-green-400 font-mono text-sm">
                          {formatAddress(checkAddress)} is an authorized issuer
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} className="text-plasma-pink" />
                        <span className="text-plasma-pink font-mono text-sm">
                          {formatAddress(checkAddress)} is not authorized
                        </span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Manage Issuers */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="gold">
            <h3 className="text-xl font-display font-semibold text-white mb-6 flex items-center gap-2">
              <Key size={20} className="text-neuron-gold" />
              Manage Authorized Issuers
            </h3>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-400 mb-2">
                  Issuer Address
                </label>
                <input
                  type="text"
                  value={issuerAddress}
                  onChange={(e) => setIssuerAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full p-3 bg-glass border border-glass-border rounded-xl font-mono text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-neuron-gold/50"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <NeonButton
                  variant="primary"
                  size="sm"
                  loading={isAdding}
                  disabled={!issuerAddress || isAdding}
                  onClick={handleAddIssuer}
                >
                  <UserPlus size={16} />
                  Add Issuer
                </NeonButton>
                <NeonButton
                  variant="danger"
                  size="sm"
                  loading={isRemoving}
                  disabled={!issuerAddress || isRemoving}
                  onClick={handleRemoveIssuer}
                >
                  <UserMinus size={16} />
                  Remove Issuer
                </NeonButton>
              </div>

              {addConfirmed && (
                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-green-400 font-mono text-sm">Issuer added successfully</span>
                </div>
              )}
              {removeConfirmed && (
                <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-green-400 font-mono text-sm">Issuer removed successfully</span>
                </div>
              )}
            </form>
          </GlassCard>
        </motion.div>

        {/* ZK Proof Section */}
        <motion.div variants={itemVariants} className="mb-8">
          <GlassCard className="p-6" glowColor="pink">
            <h3 className="text-xl font-display font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-plasma-pink" />
              ZK Proof Verification
            </h3>
            <p className="text-gray-400 font-body text-sm mb-4">
              Submit a zero-knowledge capability proof for on-chain verification. This requires
              a valid Groth16 proof with the correct public signals encoding agent capabilities.
            </p>
            <div className="p-4 bg-glass/30 rounded-xl border border-glass-border">
              <p className="font-mono text-xs text-gray-500 mb-2">Proof format:</p>
              <code className="text-biolum-cyan text-xs block space-y-1">
                <p>pA: [bigint, bigint]</p>
                <p>pB: [[bigint, bigint], [bigint, bigint]]</p>
                <p>pC: [bigint, bigint]</p>
                <p>pubSignals: [bigint, bigint, bigint, bigint, bigint]</p>
              </code>
            </div>
            <p className="text-gray-600 font-mono text-xs mt-3">
              Generate proofs using the snarkjs circuit in /agents/contracts/capabilityVerifier.circom
            </p>
          </GlassCard>
        </motion.div>

        {/* Back Link */}
        <motion.div variants={itemVariants} className="text-center">
          <Link href="/dashboard">
            <NeonButton variant="ghost" size="sm">
              <ArrowRight size={14} className="rotate-180" />
              Back to Dashboard
            </NeonButton>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
