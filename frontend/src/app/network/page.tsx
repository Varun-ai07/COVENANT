"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import NetworkGraph from "@/components/NetworkGraph";
import { useAgentCount, useTaskCount, useReceiptCount } from "@/hooks/useStats";
import { NetworkStatsSummary } from "@/components/NetworkStatsSummary";

export default function NetworkPage() {
  const { address, isConnected } = useAccount();
  const [agentCount, setAgentCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [receiptCount, setReceiptCount] = useState(0);
  const [networkStats, setNetworkStats] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  useEffect(() => {
    const fetchNetworkStats = async () => {
      if (!isConnected) return;
      
      try {
        const [agentRes, taskRes, receiptRes, statsRes] = await Promise.allSettled([
          fetch(`/api/agents/count`),
          fetch(`/api/tasks/count`),
          fetch(`/api/receipts/count`),
          fetch(`/api/network/stats`)
        ]);
        
        if (agentRes.status === "fulfilled" && agentRes.value.ok) {
          const data = await agentRes.value.json();
          setAgentCount(data.count || 0);
        }
        if (taskRes.status === "fulfilled" && taskRes.value.ok) {
          const data = await taskRes.value.json();
          setTaskCount(data.count || 0);
        }
        if (receiptRes.status === "fulfilled" && receiptRes.value.ok) {
          const data = await receiptRes.value.json();
          setReceiptCount(data.count || 0);
        }
        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const data = await statsRes.value.json();
          setNetworkStats(data);
          setLastUpdate(Date.now());
        }
      } catch (error) {
        console.error("Failed to fetch network stats:", error);
      }
    };
    
    fetchNetworkStats();
    const interval = setInterval(fetchNetworkStats, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, [isConnected]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="font-silkscreen text-4xl text-violet-400 mb-6">
            COVENANT NETWORK
          </h2>
          <p className="text-white/50 text-lg">
            Please connect your wallet to view the network graph
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/50">
      {/* Page Header */}
      <div className="p-6">
        <h1 className="font-silkscreen text-3xl text-white mb-4">
          AGENT NETWORK GRAPH
        </h1>
        <p className="text-white/40">
          Live visualization of agent connections and task flows
        </p>
      </div>

      {/* Stats Bar */}
      <div className="px-6 py-4 bg-white/5 backdrop-blur-sm">
        <NetworkStatsSummary 
          agentCount={agentCount} 
          taskCount={taskCount} 
          receiptCount={receiptCount} 
          networkStats={networkStats}
          lastUpdate={lastUpdate}
        />
      </div>

      {/* Network Graph */}
      <div className="px-6 py-4">
        <NetworkGraph />
      </div>
    </div>
  );
}