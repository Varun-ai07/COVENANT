"use client";

import { useState, useEffect } from "react";
import { RainbowKitButton, ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useConnect } from "@rainbow-me/rainbowkit";
import { useAccount as useViemAccount } from "wagmi";

export default function VerifierDashboard() {
  const [verificationStatus, setVerificationStatus] = useState("idle");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const { address, isConnected } = useViemAccount();

  const handleVerify = async () => {
    if (!isConnected) return;

    setVerificationStatus("processing");
    setIsChecking(true);

    // Simulate verification process
    await new Promise(resolve => setTimeout(resolve, 2000));

    setVerificationResult({
      score: 91,
      status: "PASS",
      criteria: {
        "url_accessible": "PASS",
        "api_endpoint": "PASS",
        "database_check": "PASS",
        "test_coverage": "PASS",
        "performance": "PASS",
        "security": "PASS",
        "code_quality": "PASS"
      },
      totalScore: 91
    });
    setVerificationStatus("verified");
    setIsChecking(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-100">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <section className="max-w-4xl mx-auto">
          <h1 className="font-silkscreen text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
            VERIFIER DASHBOARD
          </h1>

          {/* Verification Controls */}
          <div className="glass-card p-8 mb-8">
            <div className="text-center mb-6">
              <p className="text-slate-400 text-sm mb-2 font-silkscreen tracking-[0.1em]">TASK VERIFICATION</p>
              <p className="text-white/80">Verify deliverables against machine-verifiable specifications</p>
            </div>

            <div className="flex gap-4 justify-center mb-6">
              {!isConnected && (
                <ConnectButton />
              )}
              {isConnected && (
                <button
                  onClick={handleVerify}
                  disabled={isChecking}
                  className={`px-8 py-3 font-semibold rounded-xl transition-all duration-300 font-silkscreen text-sm tracking-[0.1em] ${
                    isChecking
                      ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
                  }`}
                >
                  {isChecking ? "VERIFYING..." : "VERIFY DELIVERABLE"}
                </button>
              )}
            </div>

            {/* Verification Result */}
            {verificationStatus !== "idle" && (
              <div className="mt-8 p-6 rounded-2xl border transition-all duration-300">
                {verificationStatus === "processing" ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-violet-500 mx-auto mb-4"></div>
                    <p className="text-slate-400 font-semibold">Verifying deliverable against specifications...</p>
                  </div>
                ) : verificationStatus === "verified" && verificationResult && (
                  <div className="space-y-6">
                    {/* Overall Result */}
                    <div className="text-center">
                      <p className="text-sm text-slate-400 mb-2 font-mono">VERIFICATION RESULT</p>
                      <p className={`text-4xl font-bold ${verificationResult.status === "PASS" ? "text-green-400" : "text-red-400"}`}>
                        {verificationResult.status}
                      </p>
                      <p className="text-slate-600 text-sm mt-1">Score: {verificationResult.score}/100</p>
                    </div>

                    {/* Criteria Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(verificationResult.criteria).map(([key, value]) => (
                        <div key={key} className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-white/5">
                          <p className="text-xs text-slate-400 mb-1 font-mono capitalize">{key}</p>
                          <p className={`text-sm font-semibold ${value === "PASS" ? "text-green-400" : "text-red-400"}`}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Reward Information */}
                    {verificationResult.status === "PASS" && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                        <p className="text-emerald-400 font-semibold text-sm mb-1">✓ VERIFICATION COMPLETE</p>
                        <p className="text-white font-bold">Reward Released</p>
                        <p className="text-slate-400 text-xs mt-1">Payment transferred to worker wallet</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent Verifications */}
          <div>
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-slate-300">
              📋 RECENT VERIFICATIONS
            </h2>
            <div className="space-y-4">
              <RecentVerification />
              <RecentVerification />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Navigation() {
  return (
    <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50 bg-slate-900/80">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">C</span>
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
            COVENANT
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400 hidden sm:block">
            {new Date().toLocaleDateString()}
          </span>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}

function RecentVerification() {
  return (
    <div className="glass-card p-6 border border-white/5 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400 font-semibold">Task #0042 Verification</p>
          <p className="text-white font-mono text-xs">0x8a3d...c9f2</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 bg-green-500/20 text-green-400 text-[10px] font-semibold rounded-full">
            VERIFIED
          </span>
          <span className="text-sm text-slate-400">2 hours ago</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="text-xs text-slate-500">Score: 91/100</p>
        <p className="text-xs text-slate-400">Criteria: 7/7 passed</p>
      </div>
    </div>
  );
}