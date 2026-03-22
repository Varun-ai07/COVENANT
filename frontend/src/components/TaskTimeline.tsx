"use client";

import { TaskStatus, TASK_STATUS_LABELS } from "@/types";

interface TaskTimelineProps {
  currentStatus: TaskStatus;
}

const STATUS_ORDER: TaskStatus[] = [
  TaskStatus.Created,
  TaskStatus.Funded,
  TaskStatus.InProgress,
  TaskStatus.Submitted,
  TaskStatus.Completed,
];

export function TaskTimeline({ currentStatus }: TaskTimelineProps) {
  const isFailed = currentStatus === TaskStatus.Failed;
  const isDisputed = currentStatus === TaskStatus.Disputed;

  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-white/5 -translate-y-1/2 rounded-full" />
        <div
          className={`absolute left-0 top-1/2 h-0.5 -translate-y-1/2 transition-all duration-500 rounded-full ${
            isFailed ? "bg-red-500" : isDisputed ? "bg-orange-500" : "bg-gradient-to-r from-violet-500 to-emerald-500"
          }`}
          style={{
            width: `${Math.min(
              (STATUS_ORDER.indexOf(
                isFailed || isDisputed ? TaskStatus.Submitted : currentStatus
              ) /
                (STATUS_ORDER.length - 1)) *
                100,
              100
            )}%`,
          }}
        />

        {STATUS_ORDER.map((status, index) => {
          const isCompleted = STATUS_ORDER.indexOf(currentStatus) >= index;
          const isCurrent = currentStatus === status;

          return (
            <div key={status} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-semibold border-2 transition-all duration-300 ${
                  isFailed && index >= STATUS_ORDER.indexOf(TaskStatus.Submitted)
                    ? "bg-red-500/20 border-red-500 text-red-400"
                    : isDisputed && index >= STATUS_ORDER.indexOf(TaskStatus.Submitted)
                    ? "bg-orange-500/20 border-orange-500 text-orange-400"
                    : isCompleted
                    ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                    : "bg-black/20 border-white/10 text-slate-500"
                } ${isCurrent ? "shadow-glow-violet scale-110" : ""}`}
              >
                {isFailed && index >= STATUS_ORDER.indexOf(TaskStatus.Submitted) ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-2 text-xs ${
                  isCurrent ? "text-white font-medium" : isCompleted ? "text-slate-300" : "text-slate-600"
                }`}
              >
                {TASK_STATUS_LABELS[status]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Special status indicators */}
      {isFailed && (
        <div className="mt-6 text-center">
          <span className="px-4 py-2 bg-red-500/10 text-red-400 text-sm rounded-xl border border-red-500/20 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Task Failed
          </span>
        </div>
      )}
      {isDisputed && (
        <div className="mt-6 text-center">
          <span className="px-4 py-2 bg-orange-500/10 text-orange-400 text-sm rounded-xl border border-orange-500/20 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Under Dispute
          </span>
        </div>
      )}
    </div>
  );
}
