"use client";

import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useTask } from "@/hooks/useTask";
import { useAgentByAddress } from "@/hooks/useAgent";
import { TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_COLORS, formatAddress, getReputationLevel, Agent } from "@/types";
import { TaskTimeline } from "@/components/TaskTimeline";
import { TaskActions } from "@/components/TaskActions";
import { IPFSViewer } from "@/components/IPFSViewer";

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params?.id ? BigInt(params.id as string) : undefined;
  const { address } = useAccount();

  const { task, isLoading, refetch } = useTask(taskId);
  const { agent: clientAgent } = useAgentByAddress(task?.client as `0x${string}`);
  const { agent: workerAgent } = useAgentByAddress(task?.worker as `0x${string}`);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
          <div className="h-8 bg-white/5 rounded w-1/3 shimmer" />
          <div className="h-64 glass-card shimmer" />
          <div className="h-32 glass-card shimmer" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <div className="glass-card p-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Task Not Found</h1>
          <p className="text-slate-400">Task #{params?.id} does not exist or could not be loaded.</p>
        </div>
      </div>
    );
  }

  const status = task.status as TaskStatus;
  const isClient = address?.toLowerCase() === task.client.toLowerCase();
  const isWorker = address?.toLowerCase() === task.worker.toLowerCase();

  const deadlineDate = new Date(Number(task.deadline) * 1000);
  const createdDate = new Date(Number(task.createdAt) * 1000);
  const completedDate = task.completedAt > BigInt(0) ? new Date(Number(task.completedAt) * 1000) : null;

  const clientReputation = clientAgent ? getReputationLevel(Number(clientAgent.reputation)) : null;
  const workerReputation = workerAgent ? getReputationLevel(Number(workerAgent.reputation)) : null;

  const statusConfig: Record<number, { bg: string; border: string; text: string }> = {
    0: { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-400" },
    1: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" },
    2: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
    3: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400" },
    4: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
    5: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400" },
  };

  const sConfig = statusConfig[status] || statusConfig[0];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Task #{taskId?.toString()}</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Created {createdDate.toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-4 py-2 ${sConfig.bg} ${sConfig.border} ${sConfig.text} font-medium rounded-xl border`}>
            <span className="w-2 h-2 rounded-full bg-current" />
            {TASK_STATUS_LABELS[status]}
          </span>
          <span className="text-2xl font-bold text-white">{formatEther(task.payment)} <span className="text-sm text-slate-500">ETH</span></span>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Task Lifecycle
        </h2>
        <TaskTimeline currentStatus={status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Parties */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Parties
          </h2>

          {/* Client */}
          <div className="mb-4 p-4 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Client {isClient && <span className="text-violet-400">(You)</span>}
              </span>
              {clientReputation && (
                <span className={`text-xs px-2 py-1 rounded-md ${clientReputation.bgColor}/10 ${clientReputation.color}`}>
                  {clientReputation.label}
                </span>
              )}
            </div>
            <p className="text-white font-mono text-sm">{formatAddress(task.client, 8)}</p>
            {clientAgent && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-slate-400">{clientAgent.name}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">Rep: {clientAgent.reputation.toString()}</span>
              </div>
            )}
          </div>

          {/* Worker */}
          <div className="p-4 bg-black/20 rounded-xl border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Worker {isWorker && <span className="text-emerald-400">(You)</span>}
              </span>
              {workerReputation && (
                <span className={`text-xs px-2 py-1 rounded-md ${workerReputation.bgColor}/10 ${workerReputation.color}`}>
                  {workerReputation.label}
                </span>
              )}
            </div>
            <p className="text-white font-mono text-sm">{formatAddress(task.worker, 8)}</p>
            {workerAgent && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <span className="text-slate-400">{workerAgent.name}</span>
                <span className="text-slate-600">|</span>
                <span className="text-slate-500">Rep: {workerAgent.reputation.toString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Details
          </h2>

          <div className="space-y-4">
            {[
              { label: "Payment", value: `${formatEther(task.payment)} ETH`, highlight: true },
              { label: "Deadline", value: deadlineDate.toLocaleString(), danger: deadlineDate < new Date() },
              { label: "Status", value: TASK_STATUS_LABELS[status] },
              ...(completedDate ? [{ label: "Completed", value: completedDate.toLocaleString() }] : []),
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center py-3 border-b border-white/5 last:border-0">
                <span className="text-slate-400 text-sm">{item.label}</span>
                <span className={`text-sm font-medium ${
                  item.danger ? "text-red-400" : item.highlight ? "text-white" : "text-slate-200"
                }`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Basescan Links */}
          <div className="mt-6 pt-4 border-t border-white/5">
            <p className="text-slate-500 text-xs mb-3">External Links</p>
            <div className="flex gap-3">
              <a
                href={`https://sepolia.basescan.org/address/${task.client}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 text-sm hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Client on Basescan
              </a>
              <a
                href={`https://sepolia.basescan.org/address/${task.worker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 text-sm hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Worker on Basescan
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* IPFS Content */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Task Description (IPFS)
        </h2>
        <IPFSViewer hash={task.descriptionHash} label="Task Description" />
      </div>

      {/* Deliverable (if submitted) */}
      {(status === TaskStatus.Submitted ||
        status === TaskStatus.Completed ||
        status === TaskStatus.Failed) &&
        task.deliverableHash && (
          <div className="glass-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Work Deliverable (IPFS)
            </h2>
            <IPFSViewer hash={task.deliverableHash} label="Deliverable" />
          </div>
        )}

      {/* Actions */}
      {(isClient || isWorker) && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Actions
          </h2>
          <TaskActions
            taskId={taskId!}
            status={status}
            isClient={isClient}
            isWorker={isWorker}
            onSuccess={refetch}
          />
        </div>
      )}

      {/* Role indicator */}
      {!isClient && !isWorker && (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 bg-white/5 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-slate-400">
            Connect with the client or worker wallet to perform actions on this task.
          </p>
        </div>
      )}
    </div>
  );
}
