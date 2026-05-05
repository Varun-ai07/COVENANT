"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Clock,
  User,
  Coins,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatAddress, formatEth, TASK_STATUS_LABELS, TaskStatus } from "@/types";

interface TaskCardProps {
  taskId: bigint | number;
  client?: string;
  worker?: string;
  payment?: bigint;
  status?: number;
  deadline?: bigint;
  className?: string;
}

export function TaskCard({
  taskId,
  client,
  worker,
  payment,
  status,
  deadline,
  className,
}: TaskCardProps) {
  const isOverdue =
    deadline &&
    Number(deadline) * 1000 < Date.now() &&
    status !== TaskStatus.Completed &&
    status !== TaskStatus.Failed;

  const glowColor =
    status === TaskStatus.Completed
      ? "cyan"
      : status === TaskStatus.Failed
      ? "pink"
      : status === TaskStatus.InProgress
      ? "gold"
      : "violet";

  return (
    <Link href={`/tasks/${taskId}`} className={`block ${className || ""}`}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.2 }}
      >
        <GlassCard
          className="p-5 hover:border-synapse-violet/40 transition-all duration-300 cursor-pointer group"
          glowColor={glowColor}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-synapse-violet" />
              <span className="font-mono text-sm font-semibold text-white">
                Task #{taskId.toString()}
              </span>
            </div>
            {status !== undefined && (
              <StatusBadge status={status} size="sm" />
            )}
          </div>

          <div className="space-y-2 text-sm">
            {client && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs flex items-center gap-1">
                  <User size={12} />
                  Client
                </span>
                <span className="text-gray-300 font-mono text-xs">
                  {formatAddress(client)}
                </span>
              </div>
            )}

            {worker && worker !== "0x0000000000000000000000000000000000000000" && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs flex items-center gap-1">
                  <User size={12} />
                  Worker
                </span>
                <span className="text-biolum-cyan font-mono text-xs">
                  {formatAddress(worker)}
                </span>
              </div>
            )}

            {payment !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs flex items-center gap-1">
                  <Coins size={12} />
                  Payment
                </span>
                <span className="text-neuron-gold font-mono text-sm font-semibold">
                  {formatEth(payment)} ETH
                </span>
              </div>
            )}

            {deadline && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-mono text-xs flex items-center gap-1">
                  <Clock size={12} />
                  Deadline
                </span>
                <span
                  className={`font-mono text-xs ${
                    isOverdue ? "text-plasma-pink" : "text-gray-300"
                  }`}
                >
                  {isOverdue && <AlertTriangle size={10} className="inline mr-1" />}
                  {new Date(Number(deadline) * 1000).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-glass-border flex items-center justify-end">
            <span className="text-xs font-mono text-synapse-violet group-hover:text-plasma-pink transition-colors flex items-center gap-1">
              View Details
              <ArrowRight size={12} />
            </span>
          </div>
        </GlassCard>
      </motion.div>
    </Link>
  );
}
