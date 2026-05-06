"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Clock,
  User,
  Coins,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatAddress, formatEth, TaskStatus } from "@/types";

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

  return (
    <Link href={`/tasks/${taskId}`} className={`block ${className || ""}`}>
      <motion.div whileHover={{ scale: 1.005 }} transition={{ duration: 0.15 }}>
        <Card
          variant="interactive"
          padding="md"
          className="group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              <span className="font-mono text-sm font-semibold text-foreground">
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
                <span className="text-muted font-mono text-xs flex items-center gap-1">
                  <User size={12} />
                  Client
                </span>
                <span className="text-foreground/70 font-mono text-xs">
                  {formatAddress(client)}
                </span>
              </div>
            )}

            {worker && worker !== "0x0000000000000000000000000000000000000000" && (
              <div className="flex items-center justify-between">
                <span className="text-muted font-mono text-xs flex items-center gap-1">
                  <User size={12} />
                  Worker
                </span>
                <span className="text-info font-mono text-xs">
                  {formatAddress(worker)}
                </span>
              </div>
            )}

            {payment !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted font-mono text-xs flex items-center gap-1">
                  <Coins size={12} />
                  Payment
                </span>
                <span className="text-warning font-mono text-sm font-semibold">
                  {formatEth(payment)} ETH
                </span>
              </div>
            )}

            {deadline && (
              <div className="flex items-center justify-between">
                <span className="text-muted font-mono text-xs flex items-center gap-1">
                  <Clock size={12} />
                  Deadline
                </span>
                <span
                  className={`font-mono text-xs ${
                    isOverdue ? "text-danger" : "text-foreground/70"
                  }`}
                >
                  {isOverdue && <AlertTriangle size={10} className="inline mr-1" />}
                  {new Date(Number(deadline) * 1000).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border flex items-center justify-end">
            <span className="text-xs font-mono text-accent group-hover:text-accent-hover transition-colors flex items-center gap-1">
              View Details
              <ArrowRight size={12} />
            </span>
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}
