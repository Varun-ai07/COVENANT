"use client";

import { motion } from "framer-motion";

/**
 * HeroPattern — Subtle animated geometric mesh for the hero section
 * Dark theme with violet accents and purple glow effects
 */
export function HeroPattern() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Radial gradient overlay - violet */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full"
        style={{
          background:
            "radial-gradient(ellipse, rgba(109,40,217,0.12) 0%, transparent 60%)",
        }}
      />

      {/* Animated geometric lines */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ opacity: 0.2 }}
      >
        <defs>
          <pattern
            id="hero-grid"
            x="0"
            y="0"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="1" fill="#7c3aed" opacity="0.4" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#hero-grid)" />

        {/* Diagonal accent lines */}
        <motion.line
          x1="0"
          y1="200"
          x2="400"
          y2="0"
          stroke="#7c3aed"
          strokeWidth="1"
          opacity="0.3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.3 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />
        <motion.line
          x1="1040"
          y1="900"
          x2="1440"
          y2="700"
          stroke="#7c3aed"
          strokeWidth="1"
          opacity="0.3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.3 }}
          transition={{ duration: 2, delay: 0.3, ease: "easeOut" }}
        />

        {/* Floating geometric shapes */}
        <motion.circle
          cx="200"
          cy="150"
          r="40"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="1"
          opacity="0.25"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.25 }}
          transition={{ duration: 1.5, delay: 0.5 }}
        />
        <motion.circle
          cx="1240"
          cy="750"
          r="60"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="1"
          opacity="0.2"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{ duration: 1.5, delay: 0.7 }}
        />

        {/* Hexagon accent */}
        <motion.polygon
          points="1280,300 1320,330 1320,390 1280,420 1240,390 1240,330"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="1"
          opacity="0.2"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{ duration: 1.5, delay: 0.9 }}
        />
      </svg>

      {/* Animated glow orbs - violet */}
      <motion.div
        className="absolute w-96 h-96 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(109,40,217,0.15) 0%, transparent 70%)",
          top: "20%",
          right: "10%",
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, delay: 0.3 }}
      />

      <motion.div
        className="absolute w-64 h-64 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)",
          bottom: "15%",
          left: "5%",
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 2, delay: 0.6 }}
      />
    </div>
  );
}

/**
 * NodeConnection — Animated network visualization for dashboard headers
 * Shows interconnected nodes representing agent-to-agent transactions
 */
export function NodeConnection({ nodeCount = 5 }: { nodeCount?: number }) {
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    id: i,
    x: 100 + (i * 180) % 400,
    y: 50 + (i * 73) % 150,
  }));

  const connections = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 2],
    [1, 3],
  ];

  return (
    <svg
      viewBox="0 0 500 200"
      className="w-full h-auto max-w-md"
      style={{ opacity: 0.6 }}
    >
      {/* Connection lines */}
      {connections.map(([from, to], i) => (
        <motion.line
          key={i}
          x1={nodes[from].x}
          y1={nodes[from].y}
          x2={nodes[to].x}
          y2={nodes[to].y}
          stroke="#7c3aed"
          strokeWidth="1"
          strokeDasharray="4 4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{
            duration: 1.5,
            delay: 0.1 * i,
            repeat: Infinity,
            repeatType: "loop",
            repeatDelay: 3,
          }}
        />
      ))}

      {/* Nodes */}
      {nodes.map((node, i) => (
        <motion.g key={node.id}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="12"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              duration: 0.5,
              delay: 0.15 * i,
              type: "spring",
              stiffness: 200,
            }}
          />
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="4"
            fill="#7c3aed"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              duration: 0.3,
              delay: 0.15 * i + 0.2,
            }}
          />
        </motion.g>
      ))}
    </svg>
  );
}

/**
 * FlowingDots — Subtle animated dots for section separators
 */
export function FlowingDots() {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent"
          animate={{
            opacity: [0.3, 0.7, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2,
            delay: i * 0.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
