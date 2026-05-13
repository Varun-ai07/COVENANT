"use client";

import { motion } from "framer-motion";

interface FeatureIllustrationProps {
  type: "registry" | "escrow" | "verification" | "market";
  className?: string;
}

/**
 * FeatureIllustration — Minimalist SVG illustrations for feature cards
 * Each illustration represents a core protocol component
 * Uses dark theme palette with violet accent (#7c3aed)
 */
export function FeatureIllustration({
  type,
  className = "",
}: FeatureIllustrationProps) {
  const illustrations = {
    registry: <RegistryIllustration />,
    escrow: <EscrowIllustration />,
    verification: <VerificationIllustration />,
    market: <MarketIllustration />,
  };

  return (
    <motion.div
      className={`relative w-full aspect-square max-w-[180px] ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true }}
    >
      {illustrations[type]}
    </motion.div>
  );
}

/**
 * Registry — Agent identity visualization
 * Shows a central DID node with emanating identity rays
 */
function RegistryIllustration() {
  return (
    <svg viewBox="0 0 180 180" className="w-full h-full">
      {/* Background circle */}
      <motion.circle
        cx="90"
        cy="90"
        r="85"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1"
        opacity="0.15"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.15 }}
        transition={{ duration: 0.8 }}
      />

      {/* Identity rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <motion.line
          key={angle}
          x1={90}
          y1={90}
          x2={90 + Math.cos((angle * Math.PI) / 180) * 55}
          y2={90 + Math.sin((angle * Math.PI) / 180) * 55}
          stroke="#7c3aed"
          strokeWidth="1"
          opacity="0.3"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.1 * i }}
        />
      ))}

      {/* Central DID node */}
      <motion.circle
        cx="90"
        cy="90"
        r="25"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      />

      {/* Identity mark */}
      <motion.text
        x="90"
        y="95"
        textAnchor="middle"
        fontSize="14"
        fontFamily="Space Mono, monospace"
        fill="#7c3aed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        DID
      </motion.text>

      {/* Orbiting reputation dot */}
      <motion.circle
        cx="90"
        cy="90"
        r="4"
        fill="#7c3aed"
        initial={{ opacity: 0 }}
        animate={{
          opacity: [0.4, 0.8, 0.4],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{
          offsetPath: "path('M 90 35 A 55 55 0 1 1 89.99 35')",
          offsetRotate: "0deg",
        }}
      />
    </svg>
  );
}

/**
 * Escrow — Trustless payment lock visualization
 * Shows coins locked in a secure container
 */
function EscrowIllustration() {
  return (
    <svg viewBox="0 0 180 180" className="w-full h-full">
      {/* Lock container */}
      <motion.rect
        x="45"
        y="60"
        width="90"
        height="70"
        rx="8"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1.5"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 150 }}
      />

      {/* Lock shackle */}
      <motion.path
        d="M 70 60 L 70 40 A 20 20 0 0 1 110 40 L 110 60"
        fill="none"
        stroke="#7c3aed"
        strokeWidth="1.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
      />

      {/* Coins inside */}
      {[0, 1, 2].map((i) => (
        <motion.g key={i}>
          <motion.circle
            cx={65 + i * 25}
            cy="100"
            r="12"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="1"
            opacity="0.6"
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 0.6 }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.15 }}
          />
          <motion.text
            x={65 + i * 25}
            y="104"
            textAnchor="middle"
            fontSize="10"
            fontFamily="Space Mono, monospace"
            fill="#7c3aed"
            opacity="0.8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            transition={{ delay: 0.7 + i * 0.15 }}
          >
            ETH
          </motion.text>
        </motion.g>
      ))}

      {/* Status indicator */}
      <motion.circle
        cx="90"
        cy="145"
        r="5"
        fill="#10b981"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.5, delay: 1 }}
      />
    </svg>
  );
}

/**
 * Verification — Multi-stage check visualization
 * Shows data flowing through verification gates
 */
function VerificationIllustration() {
  return (
    <svg viewBox="0 0 180 180" className="w-full h-full">
      {/* Verification stages */}
      {[0, 1, 2].map((stage) => (
        <motion.g key={stage}>
          {/* Stage box */}
          <motion.rect
            x={30 + stage * 45}
            y="60"
            width="35"
            height="35"
            rx="4"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="1"
            opacity="0.5"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.5 }}
            transition={{ duration: 0.4, delay: 0.2 * stage }}
          />
          {/* Check mark */}
          <motion.path
            d={`M ${38 + stage * 45} 78 L ${44 + stage * 45} 85 L ${56 + stage * 45} 70}`}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.4 + 0.2 * stage }}
          />
        </motion.g>
      ))}

      {/* Connecting arrows */}
      {[0, 1].map((i) => (
        <motion.line
          key={i}
          x1={68 + i * 45}
          y1="77"
          x2={80 + i * 45}
          y2="77"
          stroke="#7c3aed"
          strokeWidth="1"
          opacity="0.4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.8 + i * 0.1 }}
        />
      ))}

      {/* Score meter */}
      <motion.rect
        x="30"
        y="120"
        width="120"
        height="8"
        rx="4"
        fill="rgba(124, 58, 237, 0.2)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      />
      <motion.rect
        x="30"
        y="120"
        width="96"
        height="8"
        rx="4"
        fill="#7c3aed"
        opacity="0.8"
        initial={{ width: 0 }}
        animate={{ width: 96 }}
        transition={{ duration: 1, delay: 1.2 }}
      />

      {/* Percentage label */}
      <motion.text
        x="90"
        y="150"
        textAnchor="middle"
        fontSize="12"
        fontFamily="Space Mono, monospace"
        fill="#7c3aed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        80% SCORE
      </motion.text>
    </svg>
  );
}

/**
 * Market — Decentralized marketplace visualization
 * Shows connected agents in a peer-to-peer network
 */
function MarketIllustration() {
  const centerNodes = [
    { x: 90, y: 60, label: "A" },
    { x: 50, y: 120, label: "B" },
    { x: 130, y: 120, label: "C" },
  ];

  return (
    <svg viewBox="0 0 180 180" className="w-full h-full">
      {/* Connection lines */}
      {[
        [0, 1],
        [1, 2],
        [2, 0],
      ].map(([from, to], i) => (
        <motion.line
          key={i}
          x1={centerNodes[from].x}
          y1={centerNodes[from].y}
          x2={centerNodes[to].x}
          y2={centerNodes[to].y}
          stroke="#7c3aed"
          strokeWidth="1"
          strokeDasharray="4 2"
          opacity="0.4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, delay: 0.2 * i }}
        />
      ))}

      {/* Outer orbit nodes */}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const x = 90 + Math.cos((angle * Math.PI) / 180) * 70;
        const y = 90 + Math.sin((angle * Math.PI) / 180) * 70;
        return (
          <motion.circle
            key={angle}
            cx={x}
            cy={y}
            r="4"
            fill="#7c3aed"
            opacity="0.35"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          />
        );
      })}

      {/* Center nodes */}
      {centerNodes.map((node, i) => (
        <motion.g key={i}>
          <motion.circle
            cx={node.x}
            cy={node.y}
            r="18"
            fill="none"
            stroke="#7c3aed"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
          />
          <motion.text
            x={node.x}
            y={node.y + 4}
            textAnchor="middle"
            fontSize="14"
            fontFamily="Space Mono, monospace"
            fill="#7c3aed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
          >
            {node.label}
          </motion.text>
        </motion.g>
      ))}

      {/* Center hub */}
      <motion.circle
        cx="90"
        cy="90"
        r="3"
        fill="#7c3aed"
        opacity="0.7"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.8 }}
      />
    </svg>
  );
}

/**
 * EmptyState — Illustrated empty state for lists and tables
 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Minimalist empty state illustration */}
      <svg
        viewBox="0 0 120 100"
        className="w-32 h-auto mb-6 opacity-40"
        style={{ color: "#7c3aed" }}
      >
        {/* Empty container */}
        <rect
          x="20"
          y="30"
          width="80"
          height="50"
          rx="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="6 3"
        />
        {/* Plus icon */}
        <line
          x1="60"
          y1="45"
          x2="60"
          y2="65"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="50"
          y1="55"
          x2="70"
          y2="55"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <h3 className="font-heading text-lg text-foreground mb-2">{title}</h3>
      <p className="font-body text-sm text-muted max-w-xs mb-4">{description}</p>
      {action}
    </motion.div>
  );
}
