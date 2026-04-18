"use client";

import { useState } from "react";

export default function API() {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse("Error: " + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
        API ENDPOINTS
      </h1>
      <div className="max-w-lg w-full space-y-4">
        <button
          onClick={testAPI}
          disabled={loading}
          className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? "Testing..." : "Test Health Endpoint"}
        </button>
        {response && (
          <pre className="bg-slate-800 p-6 rounded-lg border border-slate-600">
            {response}
          </pre>
        )}
      </div>
    </div>
  );
}