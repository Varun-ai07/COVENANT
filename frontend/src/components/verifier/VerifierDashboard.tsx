"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import {
  useIsAuthorizedIssuer,
  useAddAuthorizedIssuer,
  useRemoveAuthorizedIssuer,
} from "@/hooks/useCapabilityVerifier";
import { formatAddress } from "@/types";
import type { Address } from "viem";

interface VerifierDashboardProps {
  className?: string;
}

export function VerifierDashboard({ className }: VerifierDashboardProps) {
  const [checkAddr, setCheckAddr] = useState("");
  const [issuerAddr, setIssuerAddr] = useState("");

  const { isAuthorized, isLoading: checkLoading } = useIsAuthorizedIssuer(
    (checkAddr as Address) || undefined
  );
  const { addIssuer, isPending: isAdding, hash: addHash } = useAddAuthorizedIssuer();
  const { removeIssuer, isPending: isRemoving, hash: removeHash } = useRemoveAuthorizedIssuer();

  return (
    <div className={`space-y-6 ${className || ""}`}>
      {/* Status Check */}
      <GlassCard className="p-5" glowColor="cyan">
        <h4 className="text-sm font-display font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-biolum-cyan" />
          Check Issuer Status
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={checkAddr}
            onChange={(e) => setCheckAddr(e.target.value)}
            placeholder="0x..."
            className="flex-1 p-2.5 bg-glass border border-glass-border rounded-lg font-mono text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-biolum-cyan/50"
          />
        </div>
        {checkAddr && checkAddr.length >= 42 && (
          <div className="mt-3 p-3 bg-glass/30 rounded-lg">
            {checkLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-gray-500" />
                <span className="text-gray-500 font-mono text-xs">Checking...</span>
              </div>
            ) : isAuthorized !== undefined ? (
              <div className="flex items-center gap-2">
                {isAuthorized ? (
                  <>
                    <CheckCircle2 size={14} className="text-green-400" />
                    <span className="text-green-400 font-mono text-xs">Authorized</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} className="text-plasma-pink" />
                    <span className="text-plasma-pink font-mono text-xs">Not authorized</span>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
      </GlassCard>

      {/* Manage Issuers */}
      <GlassCard className="p-5" glowColor="gold">
        <h4 className="text-sm font-display font-semibold text-white mb-4 flex items-center gap-2">
          <Key size={16} className="text-neuron-gold" />
          Manage Issuers
        </h4>
        <input
          type="text"
          value={issuerAddr}
          onChange={(e) => setIssuerAddr(e.target.value)}
          placeholder="Issuer address 0x..."
          className="w-full p-2.5 bg-glass border border-glass-border rounded-lg font-mono text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-neuron-gold/50 mb-3"
        />
        <div className="flex gap-2">
          <NeonButton
            variant="primary"
            size="sm"
            loading={isAdding}
            disabled={!issuerAddr || isAdding}
            onClick={() => {
              if (issuerAddr) addIssuer(issuerAddr as Address);
            }}
          >
            <UserPlus size={14} />
            Add
          </NeonButton>
          <NeonButton
            variant="danger"
            size="sm"
            loading={isRemoving}
            disabled={!issuerAddr || isRemoving}
            onClick={() => {
              if (issuerAddr) removeIssuer(issuerAddr as Address);
            }}
          >
            <UserMinus size={14} />
            Remove
          </NeonButton>
        </div>
        {addHash && (
          <p className="mt-2 text-green-400 font-mono text-[10px]">
            Issuer added (tx: {addHash.slice(0, 10)}...)
          </p>
        )}
        {removeHash && (
          <p className="mt-2 text-green-400 font-mono text-[10px]">
            Issuer removed (tx: {removeHash.slice(0, 10)}...)
          </p>
        )}
      </GlassCard>
    </div>
  );
}
