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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
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
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
              <ShieldCheck className="w-10 h-10 text-info" />
              Capability Verifier
            </h1>
            <p className="text-muted font-body max-w-2xl">
              Zero-knowledge capability verification for agent authorization. The CapabilityVerifier uses ZK proofs to verify agent capabilities without revealing sensitive data.
            </p>
          </div>

          {/* How it works */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="p-5 border-info/30">
              <Key size={20} className="text-info mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">ZK Proofs</h3>
              <p className="text-muted font-mono text-xs">Submit Groth16 zero-knowledge proofs that attest to an agent&apos;s capabilities without exposing private data.</p>
            </Card>
            <Card className="p-5 border-accent/30">
              <ShieldCheck size={20} className="text-accent mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">On-Chain Verification</h3>
              <p className="text-muted font-mono text-xs">The contract verifies proofs on-chain and records attestations. Only authorized issuers can submit capability proofs.</p>
            </Card>
            <Card className="p-5 border-warning/30">
              <AlertTriangle size={20} className="text-warning mb-3" />
              <h3 className="font-heading font-semibold text-foreground mb-1">Issuer Management</h3>
              <p className="text-muted font-mono text-xs">Manage the set of trusted issuers who can authorize agent capabilities. Add or remove issuers as needed.</p>
            </Card>
          </div>

          {/* Proof format preview */}
          <Card className="p-6 mb-8">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <Key size={20} className="text-info" />
              Proof Format
            </h3>
            <p className="text-muted font-body text-sm mb-4">
              Generate proofs using the snarkjs circuit. The contract expects a Groth16 proof with public signals encoding agent capabilities.
            </p>
            <div className="p-4 bg-surface/30 rounded-xl border border-border">
              <code className="text-info text-xs block space-y-1 font-mono">
                <p>pA: [bigint, bigint]</p>
                <p>pB: [[bigint, bigint], [bigint, bigint]]</p>
                <p>pC: [bigint, bigint]</p>
                <p>pubSignals: [bigint, bigint, bigint, bigint, bigint]</p>
              </code>
            </div>
          </Card>

          {/* Subtle CTA */}
          <div className="mt-12 text-center p-8 rounded-xl bg-surface border border-border">
            <h3 className="font-heading text-xl text-foreground mb-2">Connect for Full Access</h3>
            <p className="text-muted font-body text-sm mb-4">Connect your wallet to manage issuers and verify capability proofs.</p>
            <Link href="/">
              <Button variant="secondary">Go to Home to Connect</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <motion.div
        className="max-w-4xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-foreground mb-2 flex items-center gap-3">
            <ShieldCheck size={40} className="text-info" />
            Capability Verifier
          </h1>
          <p className="text-muted font-mono text-sm">
            Zero-knowledge capability verification for agent authorization
          </p>
        </motion.div>

        {/* Info Card */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <Key size={24} className="text-info flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-2">
                  How It Works
                </h3>
                <p className="text-muted font-body text-sm leading-relaxed">
                  The CapabilityVerifier uses zero-knowledge proofs to verify agent capabilities without
                  revealing sensitive data. Authorized issuers can submit ZK proofs that attest to an
                  agent&apos;s abilities. The contract verifies the proof on-chain and records the attestation.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Check Issuer Status */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
              <ShieldCheck size={20} className="text-accent" />
              Check Issuer Authorization
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={checkAddress}
                onChange={(e) => setCheckAddress(e.target.value)}
                placeholder="0x..."
                className="flex-1 p-3 bg-surface-alt border border-border rounded-xl font-mono text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent/50"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {}} // The hook auto-fetches on checkAddress change
              >
                Check
              </Button>
            </div>

            {checkAddress && checkAddress.length === 42 && (
              <div className="mt-4 p-4 bg-surface/30 rounded-xl border border-border">
                {checkLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin text-muted" />
                    <span className="text-muted font-mono text-sm">Checking...</span>
                  </div>
                ) : isAuthorized !== undefined ? (
                  <div className="flex items-center gap-2">
                    {isAuthorized ? (
                      <>
                        <CheckCircle2 size={18} className="text-success" />
                        <span className="text-success font-mono text-sm">
                          {formatAddress(checkAddress)} is an authorized issuer
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle size={18} className="text-danger" />
                        <span className="text-danger font-mono text-sm">
                          {formatAddress(checkAddress)} is not authorized
                        </span>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Manage Issuers */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-6 flex items-center gap-2">
              <Key size={20} className="text-warning" />
              Manage Authorized Issuers
            </h3>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-muted mb-2">
                  Issuer Address
                </label>
                <input
                  type="text"
                  value={issuerAddress}
                  onChange={(e) => setIssuerAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full p-3 bg-surface-alt border border-border rounded-xl font-mono text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-warning/50"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="primary"
                  size="sm"
                  loading={isAdding}
                  disabled={!issuerAddress || isAdding}
                  onClick={handleAddIssuer}
                >
                  <UserPlus size={16} />
                  Add Issuer
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  loading={isRemoving}
                  disabled={!issuerAddress || isRemoving}
                  onClick={handleRemoveIssuer}
                >
                  <UserMinus size={16} />
                  Remove Issuer
                </Button>
              </div>

              {addConfirmed && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" />
                  <span className="text-success font-mono text-sm">Issuer added successfully</span>
                </div>
              )}
              {removeConfirmed && (
                <div className="p-3 bg-success/10 border border-success/30 rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-success" />
                  <span className="text-success font-mono text-sm">Issuer removed successfully</span>
                </div>
              )}
            </form>
          </Card>
        </motion.div>

        {/* ZK Proof Section */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertTriangle size={20} className="text-danger" />
              ZK Proof Verification
            </h3>
            <p className="text-muted font-body text-sm mb-4">
              Submit a zero-knowledge capability proof for on-chain verification. This requires
              a valid Groth16 proof with the correct public signals encoding agent capabilities.
            </p>
            <div className="p-4 bg-surface/30 rounded-xl border border-border">
              <p className="font-mono text-xs text-muted mb-2">Proof format:</p>
              <code className="text-info text-xs block space-y-1">
                <p>pA: [bigint, bigint]</p>
                <p>pB: [[bigint, bigint], [bigint, bigint]]</p>
                <p>pC: [bigint, bigint]</p>
                <p>pubSignals: [bigint, bigint, bigint, bigint, bigint]</p>
              </code>
            </div>
            <p className="text-muted font-mono text-xs mt-3">
              Generate proofs using the snarkjs circuit in /agents/contracts/capabilityVerifier.circom
            </p>
          </Card>
        </motion.div>

        {/* Back Link */}
        <motion.div variants={itemVariants} className="text-center">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowRight size={14} className="rotate-180" />
              Back to Dashboard
            </Button>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
