"use client";

import { motion } from "framer-motion";
import { User, Star, Shield, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatAddress, formatEth } from "@/types";

interface AgentCardProps {
  address: string;
  name: string;
  reputation: bigint;
  stakedAmount: bigint;
  tasksCompleted: bigint;
  tasksFailed: bigint;
  capabilities?: string[];
  isActive?: boolean;
  className?: string;
  rank?: number;
}

export function AgentCard({
  address,
  name,
  reputation,
  stakedAmount,
  tasksCompleted,
  tasksFailed,
  capabilities,
  isActive = true,
  className,
  rank,
}: AgentCardProps) {
  const totalTasks = Number(tasksCompleted) + Number(tasksFailed);
  const successRate =
    totalTasks > 0
      ? Math.round((Number(tasksCompleted) / totalTasks) * 100)
      : 0;

  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      <Card variant="interactive" padding="md">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-muted border border-accent/20 flex items-center justify-center">
              <User size={20} className="text-accent" />
            </div>
            <div>
              <h4 className="font-heading font-semibold text-foreground text-sm">
                {name}
              </h4>
              <p className="font-mono text-[10px] text-muted">
                {formatAddress(address)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rank && (
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-warning/10 border border-warning/30 text-warning">
                #{rank}
              </span>
            )}
            {!isActive && (
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-surface-alt border border-border text-muted">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star size={12} className="text-warning" />
            </div>
            <p className="text-lg font-heading font-bold text-foreground">
              {Number(reputation)}
            </p>
            <p className="text-[10px] font-mono text-muted">Reputation</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap size={12} className="text-info" />
            </div>
            <p className="text-lg font-heading font-bold text-foreground">
              {Number(tasksCompleted)}
            </p>
            <p className="text-[10px] font-mono text-muted">Tasks</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield size={12} className="text-success" />
            </div>
            <p className="text-lg font-heading font-bold text-foreground">
              {successRate}%
            </p>
            <p className="text-[10px] font-mono text-muted">Success</p>
          </div>
        </div>

        {/* Staked */}
        <div className="flex items-center justify-between p-2 bg-surface-alt rounded-lg mb-3">
          <span className="text-muted font-mono text-xs">Staked</span>
          <span className="text-warning font-mono text-xs font-semibold">
            {formatEth(stakedAmount)} ETH
          </span>
        </div>

        {/* Capabilities */}
        {capabilities && capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {capabilities.slice(0, 4).map((cap, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-surface-alt border border-border text-muted"
              >
                {cap}
              </span>
            ))}
            {capabilities.length > 4 && (
              <span className="px-2 py-0.5 text-[10px] font-mono text-muted">
                +{capabilities.length - 4}
              </span>
            )}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
