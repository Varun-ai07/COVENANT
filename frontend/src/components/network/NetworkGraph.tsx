"use client";

import { useRef, useEffect, useState, useMemo } from "react";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  vx: number;
  vy: number;
}

interface Edge {
  from: string;
  to: string;
  color: string;
}

interface NetworkGraphProps {
  nodes: { id: string; label: string; color?: string }[];
  edges: { from: string; to: string; color?: string }[];
  width?: number;
  height?: number;
  className?: string;
}

const COLORS = {
  accent: "#575757",
  accentHover: "#3d3d3d",
  info: "#0891b2",
  warning: "#d97706",
  node: "#1a1917",
  edge: "rgba(26, 25, 23, 0.15)",
  text: "#1a1917",
};

export function NetworkGraph({
  nodes: inputNodes,
  edges: inputEdges,
  width = 600,
  height = 400,
  className,
}: NetworkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const animationRef = useRef<number>();

  const nodes: Node[] = useMemo(() => {
    const cx = width / 2;
    const cy = height / 2;
    const r = Math.min(width, height) * 0.3;
    return inputNodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / inputNodes.length;
      return {
        id: n.id,
        label: n.label,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        radius: 20,
        color: n.color || COLORS.accent,
        vx: 0,
        vy: 0,
      };
    });
  }, [inputNodes, width, height]);

  const edges: Edge[] = useMemo(
    () =>
      inputEdges.map((e) => ({
        ...e,
        color: e.color || COLORS.edge,
      })),
    [inputEdges]
  );

  useEffect(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const cx = width / 2;
    const cy = height / 2;

    let frame = 0;
    const maxFrames = 120;

    const step = () => {
      if (frame++ > maxFrames) return;

      for (const node of nodes) {
        node.vx += (cx - node.x) * 0.001;
        node.vy += (cy - node.y) * 0.001;
      }

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = 500 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }

      for (const edge of edges) {
        const a = nodeMap.get(edge.from);
        const b = nodeMap.get(edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const ideal = 100;
        const force = (dist - ideal) * 0.005;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const node of nodes) {
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
        node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
      }

      draw();
      animationRef.current = requestAnimationFrame(step);
    };

    animationRef.current = requestAnimationFrame(step);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [nodes, edges, width, height]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) continue;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = edge.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    for (const node of nodes) {
      const isHovered = hoveredNode === node.id;

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}33`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.node;
      ctx.strokeStyle = isHovered ? node.color : `${node.color}66`;
      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = COLORS.text;
      ctx.font = "10px Space Mono, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(node.label.slice(0, 8), node.x, node.y + node.radius + 4);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found: string | null = null;
    for (const node of nodes) {
      const dx = mx - node.x;
      const dy = my - node.y;
      if (dx * dx + dy * dy <= node.radius * node.radius) {
        found = node.id;
        break;
      }
    }
    if (found !== hoveredNode) {
      setHoveredNode(found);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`rounded-xl ${className || ""}`}
      style={{ background: "transparent" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredNode(null)}
    />
  );
}
