"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  User,
  Star,
  Shield,
  ArrowRight,
  Zap,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
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
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className={className}
    >
      <GlassCard
        className="p-5 hover:border-biolum-cyan/40 transition-all duration-300 group"
        glowColor="cyan"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-synapse-violet/20 border border-synapse-violet/40 flex items-center justify-center">
              <User size={20} className="text-synapse-violet" />
            </div>
            <div>
              <h4 className="font-display font-semibold text-white text-sm">
                {name}
              </h4>
              <p className="font-mono text-[10px] text-gray-500">
                {formatAddress(address)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rank && (
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-neuron-gold/10 border border-neuron-gold/30 text-neuron-gold">
                #{rank}
              </span>
            )}
            {!isActive && (
              <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-gray-700/30 border border-gray-600/30 text-gray-500">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Star size={12} className="text-neuron-gold" />
            </div>
            <p className="text-lg font-display font-bold text-white">
              {Number(reputation)}
            </p>
            <p className="text-[10px] font-mono text-gray-600">Reputation</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap size={12} className="text-biolum-cyan" />
            </div>
            <p className="text-lg font-display font-bold text-white">
              {Number(tasksCompleted)}
            </p>
            <p className="text-[10px] font-mono text-gray-600">Tasks</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Shield size={12} className="text-plasma-pink" />
            </div>
            <p className="text-lg font-display font-bold text-white">
              {successRate}%
            </p>
            <p className="text-[10px] font-mono text-gray-600">Success</p>
          </div>
        </div>

        {/* Staked */}
        <div className="flex items-center justify-between p-2 bg-glass/30 rounded-lg mb-3">
          <span className="text-gray-500 font-mono text-xs">Staked</span>
          <span className="text-neuron-gold font-mono text-xs font-semibold">
            {formatEth(stakedAmount)} ETH
          </span>
        </div>

        {/* Capabilities */}
        {capabilities && capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {capabilities.slice(0, 4).map((cap, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-glass border border-glass-border text-gray-400"
              >
                {cap}
              </span>
            ))}
            {capabilities.length > 4 && (
              <span className="px-2 py-0.5 text-[10px] font-mono text-gray-600">
                +{capabilities.length - 4}
              </span>
            )}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
