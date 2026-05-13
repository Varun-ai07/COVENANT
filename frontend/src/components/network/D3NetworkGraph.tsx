"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as d3 from "d3";

// Node types for the force simulation
interface SimulationNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: "agent" | "task";
  reputation?: number;
  status?: string;
  value?: number;
  radius: number;
  color: string;
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: string;
  target: string;
  value?: number;
  type: "client-worker" | "bid" | "completed";
}

interface D3NetworkGraphProps {
  agents: Array<{
    address: string;
    name?: string;
    reputation: number;
    tasksCompleted: number;
    isActive?: boolean;
  }>;
  tasks: Array<{
    id: string;
    client: string;
    worker?: string;
    payment: bigint;
    status: string;
  }>;
  width?: number;
  height?: number;
  onNodeClick?: (node: { id: string; type: string }) => void;
  className?: string;
}

// Warm stone palette matching the design system
const COLORS = {
  agent: {
    active: "#575757",
    inactive: "#a8a29e",
    border: "#1a1917",
  },
  task: {
    open: "#0891b2",      // cyan-600
    inProgress: "#d97706", // amber-600
    completed: "#059669",  // emerald-600
    failed: "#dc2626",     // red-600
    disputed: "#9333ea",   // purple-600
  },
  link: {
    clientWorker: "rgba(26, 25, 23, 0.4)",
    bid: "rgba(8, 145, 178, 0.3)",
    completed: "rgba(5, 150, 105, 0.5)",
  },
  text: "#1a1917",
  background: "transparent",
};

function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "open":
      return COLORS.task.open;
    case "inprogress":
    case "in_progress":
      return COLORS.task.inProgress;
    case "completed":
      return COLORS.task.completed;
    case "failed":
      return COLORS.task.failed;
    case "disputed":
      return COLORS.task.disputed;
    default:
      return COLORS.task.open;
  }
}

export function D3NetworkGraph({
  agents,
  tasks,
  width = 800,
  height = 600,
  onNodeClick,
  className,
}: D3NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<SimulationNode | null>(null);
  const [dimensions, setDimensions] = useState({ width, height });

  // Responsive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width: w, height: h } = entries[0].contentRect;
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Build nodes and links from props
  const { nodes, links } = useCallback(() => {
    const nodeMap = new Map<string, SimulationNode>();
    const linkList: SimulationLink[] = [];

    // Create agent nodes
    agents.forEach((agent) => {
      const rep = agent.reputation || 500;
      const radius = Math.max(15, Math.min(35, 15 + (rep - 500) / 50));
      nodeMap.set(agent.address, {
        id: agent.address,
        label: agent.name || `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}`,
        type: "agent",
        reputation: rep,
        value: agent.tasksCompleted,
        radius,
        color: agent.isActive !== false ? COLORS.agent.active : COLORS.agent.inactive,
      });
    });

    // Create task nodes and links
    tasks.forEach((task) => {
      const taskId = `task-${task.id}`;
      const payment = Number(task.payment) / 1e18; // Convert from wei to ETH
      const radius = Math.max(12, Math.min(28, 12 + payment * 2));
      nodeMap.set(taskId, {
        id: taskId,
        label: `Task ${task.id}`,
        type: "task",
        status: task.status,
        value: payment,
        radius,
        color: getStatusColor(task.status),
      });

      // Client -> Task link
      if (task.client && nodeMap.has(task.client)) {
        linkList.push({
          source: task.client,
          target: taskId,
          type: "client-worker",
          value: payment,
        });
      }

      // Task -> Worker link
      if (task.worker && nodeMap.has(task.worker)) {
        linkList.push({
          source: taskId,
          target: task.worker,
          type: task.status === "Completed" ? "completed" : "client-worker",
          value: payment,
        });
      }
    });

    return { nodes: Array.from(nodeMap.values()), links: linkList };
  }, [agents, tasks])();

  // D3 force simulation
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Create container group for zoom
    const g = svg.append("g").attr("class", "graph-container");

    // Define arrow marker for directed edges
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "-0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("orient", "auto")
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .append("path")
      .attr("d", "M 0,-5 L 10,0 L 0,5")
      .attr("fill", COLORS.link.clientWorker);

    // Create force simulation
    const simulation = d3
      .forceSimulation<SimulationNode>(nodes)
      .force(
        "link",
        d3
          .forceLink<SimulationNode, SimulationLink>(links)
          .id((d) => d.id)
          .distance((d) => 80 + (d.value || 1) * 10)
          .strength(0.5)
      )
      .force("charge", d3.forceManyBody().strength(-150))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collision", d3.forceCollide().radius((d) => (d as SimulationNode).radius + 10))
      .force("x", d3.forceX(dimensions.width / 2).strength(0.05))
      .force("y", d3.forceY(dimensions.height / 2).strength(0.05));

    // Draw links
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) =>
        d.type === "completed" ? COLORS.link.completed : COLORS.link.clientWorker
      )
      .attr("stroke-width", (d) => Math.max(1, Math.min(4, (d.value || 1) * 1.5)))
      .attr("stroke-opacity", 0.6)
      .attr("marker-end", "url(#arrowhead)");

    // Draw nodes
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .style("cursor", "pointer");

    // Apply drag behavior separately to avoid generic type issues
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as any).call(
      d3.drag<SVGGElement, SimulationNode>()
        .on("start", (event: d3.D3DragEvent<SVGGElement, SimulationNode, SimulationNode>, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event: d3.D3DragEvent<SVGGElement, SimulationNode, SimulationNode>, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event: d3.D3DragEvent<SVGGElement, SimulationNode, SimulationNode>, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

    // Node circles
    node
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.color)
      .attr("stroke", COLORS.agent.border)
      .attr("stroke-width", 2)
      .attr("opacity", (d) => (d.type === "agent" && d.reputation && d.reputation < 300 ? 0.5 : 1));

    // Agent icon (inner circle for agents)
    node
      .filter((d) => d.type === "agent")
      .append("circle")
      .attr("r", 4)
      .attr("fill", "#fafaf9");

    // Task icon (square for tasks)
    node
      .filter((d) => d.type === "task")
      .append("rect")
      .attr("x", -4)
      .attr("y", -4)
      .attr("width", 8)
      .attr("height", 8)
      .attr("rx", 1)
      .attr("fill", "#fafaf9");

    // Labels
    node
      .append("text")
      .text((d) => d.label.slice(0, 12))
      .attr("x", 0)
      .attr("y", (d) => d.radius + 14)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-family", "Space Mono, monospace")
      .attr("fill", COLORS.text)
      .attr("pointer-events", "none");

    // Tooltip on hover
    node
      .on("mouseover", function(event, d) {
        setHoveredNode(d);
        d3.select(this)
          .select("circle:first-child")
          .transition()
          .duration(150)
          .attr("r", d.radius + 5)
          .attr("stroke-width", 3);

        // Highlight connected links
        link
          .transition()
          .duration(150)
          .attr("stroke-opacity", (l) => {
            const src = (l.source as unknown as SimulationNode);
            const tgt = (l.target as unknown as SimulationNode);
            return src.id === d.id || tgt.id === d.id ? 1 : 0.2;
          });
      })
      .on("mouseout", function() {
        setHoveredNode(null);
        const nodeEl = d3.select(this);
        const nodeData = nodeEl.datum() as unknown as SimulationNode;
        nodeEl
          .select("circle:first-child")
          .transition()
          .duration(150)
          .attr("r", nodeData.radius)
          .attr("stroke-width", 2);

        link.transition().duration(150).attr("stroke-opacity", 0.6);
      })
      .on("click", function(event, d) {
        onNodeClick?.({ id: d.id, type: d.type });
      });

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => {
          const src = d.source as unknown as SimulationNode;
          return src.x || 0;
        })
        .attr("y1", (d) => {
          const src = d.source as unknown as SimulationNode;
          return src.y || 0;
        })
        .attr("x2", (d) => {
          const tgt = d.target as unknown as SimulationNode;
          return tgt.x || 0;
        })
        .attr("y2", (d) => {
          const tgt = d.target as unknown as SimulationNode;
          return tgt.y || 0;
        });

      node.attr("transform", (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Initial zoom to fit
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(dimensions.width / 2, dimensions.height / 2).scale(0.8)
    );

    return () => {
      simulation.stop();
    };
  }, [nodes, links, dimensions, onNodeClick]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className || ""}`}
      style={{ width: "100%", height: "100%", minHeight: 400 }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ background: COLORS.background }}
      />

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 shadow-lg text-xs font-mono"
          style={{
            left: Math.min(dimensions.width - 150, (hoveredNode.x || 0) + 20),
            top: Math.max(10, (hoveredNode.y || 0) - 40),
          }}
        >
          <div className="font-bold text-stone-900">{hoveredNode.label}</div>
          <div className="text-stone-600">
            {hoveredNode.type === "agent" ? (
              <>
                Reputation: {hoveredNode.reputation || 0}
                <br />
                Tasks: {hoveredNode.value || 0} completed
              </>
            ) : (
              <>
                Status: {hoveredNode.status || "Unknown"}
                <br />
                Value: {hoveredNode.value?.toFixed(3) || 0} ETH
              </>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-stone-50/90 backdrop-blur-sm border border-stone-200 rounded-lg px-3 py-2 text-xs font-mono">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-stone-600" />
          <span>Agent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-cyan-600" />
          <span>Task</span>
        </div>
      </div>
    </div>
  );
}
