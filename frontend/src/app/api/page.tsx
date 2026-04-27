"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { ResourcePreloader, LazyLoader, MemoryManager } from "@/lib/performance-optimizations";

// Initialize performance managers
const preloader = ResourcePreloader.getInstance();
const memoryManager = MemoryManager.getInstance();

export default function API() {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [endpoint, setEndpoint] = useState("/api/health");

  // Memoize API configurations
  const apiEndpoints = useMemo(() => {
    return [
      { path: "/api/health", label: "Health Check" },
      { path: "/api/tasks", label: "Task List" },
      { path: "/api/open-tasks", label: "Open Tasks" },
      { path: "/api/network/stats", label: "Network Stats" }
    ];
  }, []);

  const testAPI = useCallback(async () => {
    if (!endpoint) return;

    setLoading(true);
    setResponse(null);

    try {
      // Optimistic loading state
      const startTime = performance.now();

      const res = await fetch(endpoint, {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
        signal: AbortSignal.timeout(5000)
      });

      const duration = performance.now() - startTime;

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();

      setResponse(JSON.stringify({
        endpoint,
        status: res.status,
        duration: `${duration.toFixed(2)}ms`,
        data: data,
        timestamp: new Date().toISOString()
      }, null, 2));

    } catch (error) {
      setResponse(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    preloader.preloadCriticalResources();
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="font-silkscreen text-3xl mb-2 bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
          API ENDPOINTS
        </h1>
        <p className="text-white/40 text-sm font-silkscreen tracking-[0.1em]">
          Real-time API testing and monitoring
        </p>
      </div>

      {/* Controls */}
      <div className="max-w-4xl mx-auto mb-8 glass-card p-6">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="bg-slate-700/50 backdrop-blur-sm border border-slate-600/50 rounded-lg px-4 py-2 text-sm"
          >
            {apiEndpoints.map(ep => (
              <option key={ep.path} value={ep.path}>{ep.label}</option>
            ))}
          </select>
          <button
            onClick={testAPI}
            disabled={loading}
            className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
              loading
                ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
            }`}
          >
            {loading ? "Testing..." : "TEST ENDPOINT"}
          </button>
          {!loading && response && (
            <button
              onClick={() => setResponse(null)}
              className="text-sm text-slate-400 hover:text-white transition-colors font-mono"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-4xl mx-auto">
        {response ? (
          <div className="glass-card p-6">
            <pre className="bg-slate-800 p-6 rounded-lg border border-slate-600/50 overflow-x-auto text-sm font-mono text-white">
              {response}
            </pre>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-white/40 text-lg font-silkscreen">
              Select an endpoint and click "TEST ENDPOINT"
            </p>
          </div>
        )}
      </div>
    </div>
  );
}