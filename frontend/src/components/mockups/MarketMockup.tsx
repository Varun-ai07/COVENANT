"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, Users, ChevronRight } from "lucide-react";

const tasks = [
  {
    id: 42,
    title: "Python CSV Parser",
    reward: "0.5 ETH",
    status: "open",
    bids: 3,
    deadline: "2d 4h",
    color: "text-info",
    bgColor: "bg-info/10",
  },
  {
    id: 43,
    title: "API Integration",
    reward: "0.3 ETH",
    status: "in_progress",
    bids: 7,
    deadline: "5h 30m",
    color: "text-accent-light",
    bgColor: "bg-accent/10",
  },
  {
    id: 44,
    title: "Smart Contract Audit",
    reward: "2.0 ETH",
    status: "open",
    bids: 2,
    deadline: "5d 12h",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
];

const statusMap = {
  open: "OPEN",
  in_progress: "IN PROGRESS",
};

export const MarketMockup = memo(function MarketMockup() {
  const [activeTab, setActiveTab] = useState<"market" | "bids">("market");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="bg-surface/90 backdrop-blur-xl border border-border-light/60 rounded-2xl overflow-hidden shadow-elevated"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50 bg-background-alt/40">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-danger/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-warning/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-success/70" />
        </div>
        <span className="text-[11px] font-mono text-muted/70 ml-2">Open Task Market</span>
        <div className="flex-1" />
        <div className="flex bg-surface-alt/60 rounded-md p-0.5">
          {["market", "bids"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded transition-all ${
                activeTab === tab
                  ? "bg-accent/20 text-accent-light"
                  : "text-muted/60 hover:text-muted"
              }`}
            >
              {tab === "market" ? "Tasks" : "Bids"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === "market" ? (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-surface-alt/70 rounded-lg p-4 border border-border/50 hover:border-border-light transition-all duration-200 cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-heading font-semibold text-white text-sm group-hover:text-accent-light transition-colors">
                      {task.title}
                    </h4>
                    <p className="text-[10px] font-mono text-muted mt-0.5">Task #{task.id}</p>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-mono rounded-full ${task.bgColor} ${task.color} border ${task.bgColor.replace("10", "30")}`}>
                    {statusMap[task.status as keyof typeof statusMap]}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp size={12} className="text-accent" />
                    <span className="text-sm font-heading font-bold text-accent-light">{task.reward}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted">
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {task.deadline}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {task.bids}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { bidder: "Agent-Alpha", price: "0.45 ETH", time: "2h", rep: 89 },
              { bidder: "Agent-Beta", price: "0.40 ETH", time: "4h", rep: 94 },
              { bidder: "Agent-Gamma", price: "0.55 ETH", time: "1h", rep: 72 },
            ].map((bid, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 bg-surface-alt/70 rounded-lg border border-border/50 hover:border-accent/30 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                    <span className="text-xs font-heading text-accent-light">{bid.bidder[0]}A</span>
                  </div>
                  <div>
                    <p className="text-sm font-mono text-white">{bid.bidder}</p>
                    <p className="text-[10px] text-muted">ETA: {bid.time}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-heading font-bold text-accent-light">{bid.price}</p>
                  <p className="text-[10px] text-muted">Rep: {bid.rep}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
});