"use client";

import { motion } from "framer-motion";
import {
  FileText,
  CheckCircle2,
  XCircle,
  Coins,
  Shield,
  Users,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { formatAddress, formatEth } from "@/types";

export type ActivityType =
  | "task_created"
  | "task_completed"
  | "task_failed"
  | "receipt_issued"
  | "agent_registered"
  | "payment_sent"
  | "dispute_opened"
  | "collective_joined";

interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: number;
  actor: string;
  detail?: string;
  value?: bigint;
  taskId?: number;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  emptyMessage?: string;
  maxItems?: number;
}

const activityConfig: Record<
  ActivityType,
  {
    icon: React.ReactNode;
    label: string;
    color: string;
  }
> = {
  task_created: {
    icon: <FileText size={14} />,
    label: "Created a task",
    color: "text-accent",
  },
  task_completed: {
    icon: <CheckCircle2 size={14} />,
    label: "Completed a task",
    color: "text-success",
  },
  task_failed: {
    icon: <XCircle size={14} />,
    label: "Task failed",
    color: "text-danger",
  },
  receipt_issued: {
    icon: <Coins size={14} />,
    label: "Receipt issued",
    color: "text-warning",
  },
  agent_registered: {
    icon: <Shield size={14} />,
    label: "Registered as agent",
    color: "text-info",
  },
  payment_sent: {
    icon: <Coins size={14} />,
    label: "Payment sent",
    color: "text-warning",
  },
  dispute_opened: {
    icon: <Shield size={14} />,
    label: "Dispute opened",
    color: "text-danger",
  },
  collective_joined: {
    icon: <Users size={14} />,
    label: "Joined collective",
    color: "text-info",
  },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ActivityFeed({
  activities,
  emptyMessage = "No recent activity",
  maxItems = 10,
}: ActivityFeedProps) {
  const items = activities.slice(0, maxItems);

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock size={32} className="text-muted mx-auto mb-3" />
        <p className="text-muted font-body">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const config = activityConfig[item.type];
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03, duration: 0.2 }}
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-surface border border-border rounded-xl hover:border-border-hover transition-colors">
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg bg-surface-alt border border-border flex items-center justify-center ${config.color}`}
              >
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-mono truncate">
                  {config.label}
                </p>
                <p className="text-[10px] text-muted font-mono truncate">
                  {formatAddress(item.actor)}
                  {item.detail && ` · ${item.detail}`}
                </p>
              </div>

              {/* Right side */}
              <div className="flex-shrink-0 text-right">
                {item.value !== undefined && (
                  <p className="text-xs font-mono text-warning">
                    {formatEth(item.value)} ETH
                  </p>
                )}
                <p className="text-[10px] font-mono text-muted">
                  {timeAgo(item.timestamp)}
                </p>
              </div>

              {/* Link */}
              {item.taskId !== undefined && (
                <Link href={`/tasks/${item.taskId}`}>
                  <ArrowRight
                    size={14}
                    className="text-muted hover:text-accent transition-colors"
                  />
                </Link>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
