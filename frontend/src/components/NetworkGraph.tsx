"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { useAccount } from "wagmi";
import { useTaskCounter } from "@/hooks/useTask";
import { useReceiptCount } from "@/hooks/useReceipts";
import { Agent } from "@/types";

interface NetworkNode {
  id: string;
  address: string;
  type: "agent";
  name?: string;
  reputation?: number;
  tasksCompleted?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface NetworkLink {
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: "task";
  taskId: bigint;
  payment: bigint;
  status: number;
}

export function NetworkGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { chain: _chain } = useAccount();
  const taskCount = useTaskCounter();
  const receiptCount = useReceiptCount();

  // Using chain variable to satisfy ESLint (even though not directly used in logic)
  // Chain ID is used in API calls via hooks

  const [agents, setAgents] = useState<Map<string, Agent & { address: string }>>(new Map());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Fetch all agent data
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await fetch(`/api/agents`);
        if (!response.ok) return;
        const data = await response.json();
        const agentsArray = data.agents || [];
        const agentsMap = new Map(
          agentsArray.map((agent: Agent & { address: string }) => [
            agent.address.toLowerCase(),
            agent,
          ])
        );
        setAgents(agentsMap);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      }
    };

    fetchAgents();
  }, []);

  // Fetch all tasks (through a server API that returns all task IDs and details)
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch(`/api/tasks?limit=100`);
        if (!response.ok) return;
        const data = await response.json();
        setTasks(data.tasks || []);
      } catch (error) {
        console.error("Failed to fetch tasks:", error);
      }
    };

    fetchTasks();
  }, []);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const { width } = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width, height: Math.min(600, width * 0.75) });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Build D3 simulation
  useEffect(() => {
    if (!svgRef.current || agents.size === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = dimensions.width;
    const height = dimensions.height;

    // Convert agents map to array
    const agentArray = Array.from(agents.values()).map((agent) => ({
      id: agent.address.toLowerCase(),
      address: agent.address,
      type: "agent" as const,
      name: agent.name,
      reputation: Number(agent.reputation),
      tasksCompleted: Number(agent.tasksCompleted),
    }));

    // Build links from tasks
    const links: NetworkLink[] = tasks
      .filter((task) => agents.has(task.client.toLowerCase()) && agents.has(task.worker.toLowerCase()))
      .map((task) => ({
        source: task.client.toLowerCase(),
        target: task.worker.toLowerCase(),
        type: "task" as const,
        taskId: task.id,
        payment: task.payment,
        status: task.status,
      }));

    // Create simulation
    const simulation = d3
      .forceSimulation(agentArray as NetworkNode[])
      .force("link", d3.forceLink(links).id((d) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    // Draw links
    const link = svg
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#374151")
      .attr("stroke-width", (d) => Math.max(1, Math.log10(Number(d.payment) / 1e18 + 1) * 2))
      .attr("stroke-opacity", 0.5);

    // Draw nodes
    const node = svg
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(agentArray)
      .enter()
      .append("g")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, NetworkNode, NetworkNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => 15 + Math.min(d.tasksCompleted / 10, 20))
      .attr("fill", (d) => {
        if (d.reputation >= 800) return "#10b981"; // emerald
        if (d.reputation >= 600) return "#3b82f6"; // blue
        if (d.reputation >= 400) return "#f59e0b"; // amber
        return "#ef4444"; // red
      })
      .attr("stroke", "#1f2937")
      .attr("stroke-width", 2)
      .attr("fill-opacity", 0.8);

    // Node labels
    node
      .append("text")
      .text((d) => d.name || d.address.slice(0, 6))
      .attr("text-anchor", "middle")
      .attr("dy", 25)
      .attr("fill", "#9ca3af")
      .attr("font-size", "11px")
      .attr("font-family", "monospace");

    // Tooltip on hover
    node.on("mouseover", function (event, d) {
      d3.select("body").append("div")
        .attr("class", "network-tooltip")
        .style("position", "absolute")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .style("background", "rgba(17, 24, 39, 0.95)")
        .style("border", "1px solid rgba(107, 114, 128, 0.5)")
        .style("border-radius", "8px")
        .style("padding", "8px 12px")
        .style("color", "#f3f4f6")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("z-index", "1000")
        .html(`
          <div class="font-semibold text-white mb-1">${d.name || "Unknown Agent"}</div>
          <div class="text-slate-400 text-xs">Reputation: ${d.reputation}/1000</div>
          <div class="text-slate-400 text-xs">Tasks: ${d.tasksCompleted}</div>
          <div class="text-slate-500 text-xs mt-1">${d.address.slice(0, 10)}...${d.address.slice(-8)}</div>
        `);

      d3.select(this).select("circle").attr("stroke", "#8b5cf6").attr("stroke-width", 3);
    }).on("mouseout", function () {
      d3.selectAll(".network-tooltip").remove();
      d3.select(this).select("circle").attr("stroke", "#1f2937").attr("stroke-width", 2);
    });

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: NetworkLink) => d.source.x)
        .attr("y1", (d: NetworkLink) => d.source.y)
        .attr("x2", (d: NetworkLink) => d.target.x)
        .attr("y2", (d: NetworkLink) => d.target.y);

      node.attr("transform", (d: NetworkNode) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: d3.DragEvent<SVGGElement, NetworkNode, {}>, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.DragEvent<SVGGElement, NetworkNode, {}>, d: NetworkNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.DragEvent<SVGGElement, NetworkNode, {}>, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [agents, tasks, dimensions]);

  return (
    <div className="glass-card p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Network Graph
          </h3>
          <p className="text-slate-400 text-xs mt-1">Agent connections and task flows</p>
        </div>
        <div className="flex gap-4 text-xs">
          <div className="text-center">
            <div className="text-violet-400 font-bold text-lg">{agentAddresses.length}</div>
            <div className="text-slate-500">Agents</div>
          </div>
          <div className="text-center">
            <div className="text-emerald-400 font-bold text-lg">{taskCount}</div>
            <div className="text-slate-500">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-blue-400 font-bold text-lg">{receiptCount}</div>
            <div className="text-slate-500">Receipts</div>
          </div>
        </div>
      </div>

      <div className="relative bg-black/30 rounded-xl border border-white/5 overflow-hidden">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full"
          style={{ minHeight: "400px" }}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-3 border border-white/10 text-xs">
          <div className="font-semibold text-slate-300 mb-2">Reputation</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Excellent (800+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-slate-400">Good (600-799)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-slate-400">Average (400-599)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-slate-400">Poor (&lt;400)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
