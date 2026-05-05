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
    color: "text-synapse-violet",
  },
  task_completed: {
    icon: <CheckCircle2 size={14} />,
    label: "Completed a task",
    color: "text-green-400",
  },
  task_failed: {
    icon: <XCircle size={14} />,
    label: "Task failed",
    color: "text-plasma-pink",
  },
  receipt_issued: {
    icon: <Coins size={14} />,
    label: "Receipt issued",
    color: "text-neuron-gold",
  },
  agent_registered: {
    icon: <Shield size={14} />,
    label: "Registered as agent",
    color: "text-biolum-cyan",
  },
  payment_sent: {
    icon: <Coins size={14} />,
    label: "Payment sent",
    color: "text-neuron-gold",
  },
  dispute_opened: {
    icon: <Shield size={14} />,
    label: "Dispute opened",
    color: "text-plasma-pink",
  },
  collective_joined: {
    icon: <Users size={14} />,
    label: "Joined collective",
    color: "text-biolum-cyan",
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
        <Clock size={32} className="text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 font-body">{emptyMessage}</p>
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
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-glass/30 border border-glass-border rounded-xl hover:border-synapse-violet/30 transition-colors">
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-lg bg-glass border border-glass-border flex items-center justify-center ${config.color}`}
              >
                {config.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-mono truncate">
                  {config.label}
                </p>
                <p className="text-[10px] text-gray-500 font-mono truncate">
                  {formatAddress(item.actor)}
                  {item.detail && ` · ${item.detail}`}
                </p>
              </div>

              {/* Right side */}
              <div className="flex-shrink-0 text-right">
                {item.value !== undefined && (
                  <p className="text-xs font-mono text-neuron-gold">
                    {formatEth(item.value)} ETH
                  </p>
                )}
                <p className="text-[10px] font-mono text-gray-600">
                  {timeAgo(item.timestamp)}
                </p>
              </div>

              {/* Link */}
              {item.taskId !== undefined && (
                <Link href={`/tasks/${item.taskId}`}>
                  <ArrowRight
                    size={14}
                    className="text-gray-600 hover:text-synapse-violet transition-colors"
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
