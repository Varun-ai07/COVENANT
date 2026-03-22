"use client";

import { useState, useEffect } from "react";

interface IPFSViewerProps {
  hash: string;
  label?: string;
}

interface IPFSData {
  title?: string;
  description?: string;
  instructions?: string;
  task?: string;
  report?: string;
  completedAt?: string;
  workerAddress?: string;
  [key: string]: unknown;
}

export function IPFSViewer({ hash, label = "IPFS Content" }: IPFSViewerProps) {
  const [data, setData] = useState<IPFSData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!hash || !expanded) return;

    const fetchIPFS = async () => {
      setLoading(true);
      setError(null);

      try {
        const localResponse = await fetch(`/api/ipfs/${hash}`);
        if (localResponse.ok) {
          const json = await localResponse.json();
          setData(json);
          return;
        }

        const gatewayResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
        if (gatewayResponse.ok) {
          const json = await gatewayResponse.json();
          setData(json);
          return;
        }

        setError("Could not fetch IPFS content");
      } catch {
        setError("Failed to fetch IPFS content");
      } finally {
        setLoading(false);
      }
    };

    fetchIPFS();
  }, [hash, expanded]);

  if (!hash) {
    return (
      <div className="bg-black/20 rounded-xl p-6 text-center text-slate-500 border border-white/5">
        <svg className="w-8 h-8 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        No IPFS hash available
      </div>
    );
  }

  return (
    <div className="bg-black/20 rounded-xl overflow-hidden border border-white/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <span className="text-white font-medium block">{label}</span>
            <span className="text-slate-500 text-xs font-mono">{hash.slice(0, 24)}...</span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/5 p-5 animate-slide-down">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 bg-white/5 rounded w-3/4 shimmer" />
              <div className="h-4 bg-white/5 rounded w-1/2 shimmer" />
              <div className="h-4 bg-white/5 rounded w-5/6 shimmer" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          ) : data ? (
            <div className="space-y-4">
              {data.title && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Title</p>
                  <p className="text-white">{data.title}</p>
                </div>
              )}
              {data.description && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Description</p>
                  <p className="text-slate-300 text-sm">{data.description}</p>
                </div>
              )}
              {data.task && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Task</p>
                  <p className="text-white">{data.task}</p>
                </div>
              )}
              {data.report && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Report</p>
                  <div className="bg-black/30 rounded-lg p-4 max-h-64 overflow-y-auto border border-white/5">
                    <pre className="text-slate-300 text-sm whitespace-pre-wrap">{data.report}</pre>
                  </div>
                </div>
              )}
              {data.completedAt && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Completed At</p>
                  <p className="text-slate-300">{new Date(data.completedAt).toLocaleString()}</p>
                </div>
              )}
              <div className="pt-4 border-t border-white/5">
                <p className="text-slate-500 text-xs mb-2">Raw JSON</p>
                <div className="bg-black/30 rounded-lg p-4 max-h-32 overflow-y-auto border border-white/5">
                  <pre className="text-slate-500 text-xs">{JSON.stringify(data, null, 2)}</pre>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
