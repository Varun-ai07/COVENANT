"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useAccount } from "wagmi";
import { Agent } from "@/types";

// Define color palette
const COLORS = ["#8884d8", "#82ca9d", "#ffc658"];

// Agent reputation distribution chart
function ReputationDistribution({ agents }: { agents: Agent[] }) {
  const reputationRanges = {
    "Excellent (800+)": agents.filter((a) => Number(a.reputation) >= 800).length,
    "Good (600-799)": agents.filter(
      (a) => Number(a.reputation) >= 600 && Number(a.reputation) < 800
    ).length,
    "Average (400-599)": agents.filter(
      (a) => Number(a.reputation) >= 400 && Number(a.reputation) < 600
    ).length,
    "Poor (<400)": agents.filter((a) => Number(a.reputation) < 400).length,
  };

  const data = Object.keys(reputationRanges).map((range) => ({
    name: range,
    value: reputationRanges[range as keyof typeof reputationRanges],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}

// Task status distribution chart
function TaskStatusDistribution({ tasks }: { tasks: any[] }) {
  // Assuming tasks have status field as number (0-6)
  const statusLabels = {
    0: "Created",
    1: "Funded",
    2: "In Progress",
    3: "Submitted",
    4: "Completed",
    5: "Failed",
    6: "Disputed",
  };

  const statusCounts: Record<string, number> = {};
  tasks.forEach((task) => {
    const label = statusLabels[task.status] || "Unknown";
    statusCounts[label] = (statusCounts[label] || 0) + 1;
  });

  const data = Object.keys(statusCounts).map((status) => ({
    name: status,
    value: statusCounts[status],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Agent activity chart (tasks completed vs failed)
function AgentActivity({ agents }: { agents: Agent[] }) {
  const data = agents
    .map((agent) => ({
      name: agent.name || agent.address.slice(0, 6),
      completed: Number(agent.tasksCompleted),
      failed: Number(agent.tasksFailed),
    }))
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 10); // Top 10 agents by completed tasks

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar
          dataKey="completed"
          label="Completed"
          fill="#82ca9d"
        />
        <Bar
          dataKey="failed"
          label="Failed"
          fill="#ffc658"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Payment volume chart (total value transferred by agents)
function PaymentVolume({ agents }: { agents: Agent[] }) {
  const data = agents
    .map((agent) => ({
      name: agent.name || agent.address.slice(0, 6),
      value: Number(agent.totalValueTransferred) / 1e18, // Convert wei to ETH
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Top 10 agents by value transferred

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AnalyticsDashboard() {
  const { chain } = useAccount();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all agents
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch(`/api/agents`);
        if (!response.ok) throw new Error("Failed to fetch agents");
        const data = await response.json();
        setAgents(data.agents || []);
      } catch (error) {
        console.error("Error fetching agents:", error);
        setAgents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAgents();
  }, []);

  // Fetch all tasks (limit to 200 for performance)
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?limit=200`);
        if (!response.ok) throw new Error("Failed to fetch tasks");
        const data = await response.json();
        setTasks(data.tasks || []);
      } catch (error) {
        console.error("Error fetching tasks:", error);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading analytics data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            Analytics Dashboard
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            Network metrics and agent performance
          </p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="text-center">
            <div className="text-violet-400 font-bold text-lg">
              {agents.length}
            </div>
            <div className="text-slate-500">Agents</div>
          </div>
          <div className="text-center">
            <div className="text-emerald-400 font-bold text-lg">
              {tasks.length}
            </div>
            <div className="text-slate-500">Tasks</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Reputation Distribution */}
        <div className="bg-black/30 rounded-xl border border-white/5 p-4">
          <h4 className="text-slate-400 mb-4">Agent Reputation Distribution</h4>
          <ReputationDistribution agents={agents} />
        </div>

        {/* Task Status Distribution */}
        <div className="bg-black/30 rounded-xl border border-white/5 p-4">
          <h4 className="text-slate-400 mb-4">Task Status Distribution</h4>
          <TaskStatusDistribution tasks={tasks} />
        </div>

        {/* Agent Activity */}
        <div className="bg-black/30 rounded-xl border border-white/5 p-4">
          <h4 className="text-slate-400 mb-4">Top Agents by Activity</h4>
          <AgentActivity agents={agents} />
        </div>

        {/* Payment Volume */}
        <div className="bg-black/30 rounded-xl border border-white/5 p-4">
          <h4 className="text-slate-400 mb-4">Top Agents by Value Transferred</h4>
          <PaymentVolume agents={agents} />
        </div>
      </div>
    </div>
  );
}