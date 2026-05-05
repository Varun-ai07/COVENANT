"use client";

import { useMemo } from "react";
import { TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_COLORS } from "@/types";

interface TaskTimelineProps {
  currentStatus: TaskStatus | number;
  className?: string;
}

const STATUS_ORDER = [
  TaskStatus.Created,
  TaskStatus.Funded,
  TaskStatus.InProgress,
  TaskStatus.Submitted,
  TaskStatus.Completed,
];

export default function TaskTimeline({
  currentStatus,
  className = "",
}: TaskTimelineProps) {
  const normalizedStatus =
    typeof currentStatus === "number" ? currentStatus : currentStatus;

  const statusIndex = STATUS_ORDER.indexOf(normalizedStatus as TaskStatus);

  const stages = useMemo(
    () =>
      STATUS_ORDER.map((status, index) => {
        const isCompleted = index <= statusIndex;
        const isCurrent = index === statusIndex;
        const isFailed = normalizedStatus === TaskStatus.Failed;
        const isDisputed = normalizedStatus === TaskStatus.Disputed;

        let nodeColor = "bg-gray-700 border-gray-600";
        let textColor = "text-gray-500";
        let glowClass = "";

        if (isCompleted || isCurrent) {
          nodeColor = "bg-synapse-violet border-synapse-violet";
          textColor = TASK_STATUS_COLORS[status as TaskStatus] || "text-synapse-violet";
          glowClass = "shadow-glow-violet";
        }

        if (isCurrent) {
          glowClass = "shadow-glow-violet animate-pulse-glow";
        }

        if (isFailed && index >= statusIndex) {
          nodeColor = "bg-red-500 border-red-500";
          textColor = "text-red-400";
          glowClass = "shadow-glow-pink animate-pulse-glow";
        }

        if (isDisputed && index >= statusIndex) {
          nodeColor = "bg-orange-500 border-orange-500";
          textColor = "text-orange-400";
          glowClass = "shadow-glow-gold animate-pulse-glow";
        }

        return {
          status,
          label: TASK_STATUS_LABELS[status as TaskStatus],
          isCompleted,
          isCurrent,
          nodeColor,
          textColor,
          glowClass,
        };
      }),
    [statusIndex, normalizedStatus]
  );

  return (
    <div className={`flex flex-col ${className}`}>
      {stages.map((stage, index) => (
        <div key={stage.status} className="flex items-start gap-4 relative">
          {/* Vertical line */}
          {index < stages.length - 1 && (
            <div
              className={`absolute left-[11px] top-[24px] w-[2px] h-[calc(100%-8px)] ${
                stage.isCompleted ? "bg-synapse-violet/50" : "bg-gray-700/50"
              }`}
            />
          )}

          {/* Node */}
          <div
            className={`relative z-10 w-[22px] h-[22px] rounded-full border-2 flex-shrink-0 ${
              stage.nodeColor
            } ${stage.glowClass} transition-all duration-500`}
          >
            {stage.isCompleted && !stage.isCurrent && (
              <svg
                className="absolute inset-0 w-full h-full text-white p-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>

          {/* Label */}
          <div
            className={`pb-8 ${
              stage.isCurrent ? "opacity-100" : stage.isCompleted ? "opacity-80" : "opacity-40"
            }`}
          >
            <span
              className={`font-mono text-sm ${stage.textColor} transition-colors duration-500`}
            >
              {stage.label}
            </span>
            {stage.isCurrent && (
              <span className="ml-2 text-xs text-gray-400">(current)</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
