"use client";

import { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  useIsAuthorizedIssuer,
  useAddAuthorizedIssuer,
  useRemoveAuthorizedIssuer,
} from "@/hooks/useCapabilityVerifier";
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
      <Card variant="elevated" padding="md">
        <h4 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-info" />
          Check Issuer Status
        </h4>
        <div className="flex gap-2">
          <input
            type="text"
            value={checkAddr}
            onChange={(e) => setCheckAddr(e.target.value)}
            placeholder="0x..."
            className="flex-1 p-2.5 bg-surface border border-border rounded-lg font-mono text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:border-info/50"
          />
        </div>
        {checkAddr && checkAddr.length >= 42 && (
          <div className="mt-3 p-3 bg-surface-alt rounded-lg">
            {checkLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-muted" />
                <span className="text-muted font-mono text-xs">Checking...</span>
              </div>
            ) : isAuthorized !== undefined ? (
              <div className="flex items-center gap-2">
                {isAuthorized ? (
                  <>
                    <CheckCircle2 size={14} className="text-success" />
                    <span className="text-success font-mono text-xs">Authorized</span>
                  </>
                ) : (
                  <>
                    <XCircle size={14} className="text-danger" />
                    <span className="text-danger font-mono text-xs">Not authorized</span>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
      </Card>

      {/* Manage Issuers */}
      <Card variant="elevated" padding="md">
        <h4 className="text-sm font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <Key size={16} className="text-warning" />
          Manage Issuers
        </h4>
        <input
          type="text"
          value={issuerAddr}
          onChange={(e) => setIssuerAddr(e.target.value)}
          placeholder="Issuer address 0x..."
          className="w-full p-2.5 bg-surface border border-border rounded-lg font-mono text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:border-warning/50 mb-3"
        />
        <div className="flex gap-2">
          <Button
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
          </Button>
          <Button
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
          </Button>
        </div>
        {addHash && (
          <p className="mt-2 text-success font-mono text-[10px]">
            Issuer added (tx: {addHash.slice(0, 10)}...)
          </p>
        )}
        {removeHash && (
          <p className="mt-2 text-success font-mono text-[10px]">
            Issuer removed (tx: {removeHash.slice(0, 10)}...)
          </p>
        )}
      </Card>
    </div>
  );
}
