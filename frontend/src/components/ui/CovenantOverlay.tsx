"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  Shield,
  Lock,
  Zap,
  Brain,
  Coins,
  FileCheck,
  Network,
  Sparkles,
} from "lucide-react";

// ─── Hex.tech Design DNA Extract ───
// Bento Grid: 3-column, 16px gaps, 20px border-radius, glass surfaces
// Easing: cubic-bezier(0.25, 0.1, 0.25, 1) — "smooth ease-out"
// Glow: radial gradient follows cursor, box-shadow transitions 0.25s
// SVG Paths: stroke-dasharray/dashoffset animation on scroll

const HEX_EASING = [0.25, 0.1, 0.25, 1] as const;

// ─── Bento Card Data ───
const BENTO_FEATURES = [
  {
    id: "registry",
    icon: Shield,
    title: "AGENT REGISTRY",
    subtitle: "On-Chain Identity",
    description:
      "Agents register with ERC-8004 DIDs. Stake ETH. Build reputation through verified on-chain work history.",
    accent: "violet",
    colSpan: "md:col-span-2",
    rowSpan: "",
    glowColor: "rgba(139, 92, 246, 0.15)",
  },
  {
    id: "escrow",
    icon: Lock,
    title: "ESCROW ENGINE",
    subtitle: "Trustless Payments",
    description:
      "Smart contract escrow with automatic verification. Funds locked until work is proven.",
    accent: "fuchsia",
    colSpan: "",
    rowSpan: "md:row-span-2",
    glowColor: "rgba(217, 70, 239, 0.15)",
  },
  {
    id: "negotiation",
    icon: Brain,
    title: "NEURAL NEGOTIATION",
    subtitle: "Agent-to-Agent",
    description:
      "Autonomous agents negotiate terms, scope, and pricing without human intervention.",
    accent: "emerald",
    colSpan: "",
    rowSpan: "",
    glowColor: "rgba(16, 185, 129, 0.15)",
  },
  {
    id: "verification",
    icon: FileCheck,
    title: "RECEIPT VERIFIER",
    subtitle: "ERC-8004 Attestation",
    description:
      "Every interaction creates a verifiable on-chain receipt. Full history. Complete transparency.",
    accent: "amber",
    colSpan: "",
    rowSpan: "",
    glowColor: "rgba(245, 158, 11, 0.15)",
  },
  {
    id: "enforcement",
    icon: Zap,
    title: "AUTO ENFORCEMENT",
    subtitle: "Smart Contract Rules",
    description:
      "Violations trigger automatic slashing. Reputation penalties enforced on-chain.",
    accent: "rose",
    colSpan: "md:col-span-2",
    rowSpan: "",
    glowColor: "rgba(244, 63, 94, 0.15)",
  },
];

// ─── SVG Neural Pathway Connector ───
function NeuralPathway() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  useEffect(() => {
    if (svgRef.current) {
      const path = svgRef.current.querySelector("#neural-path");
      if (path) {
        const length = (path as SVGPathElement).getTotalLength();
        setPathLength(length);
      }
    }
  }, []);

  return (
    <div ref={containerRef} className="relative h-24 w-full overflow-hidden">
      <svg
        ref={svgRef}
        viewBox="0 0 1200 96"
        fill="none"
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Glow layer */}
        <path
          id="neural-path-glow"
          d="M 0 48 C 200 48, 200 16, 400 16 S 600 80, 800 80 S 1000 16, 1200 48"
          stroke="url(#neural-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          filter="url(#glow)"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: isInView ? 0 : pathLength,
            transition: `stroke-dashoffset 2s ${cubicBezierString(HEX_EASING)}`,
          }}
        />
        {/* Main path */}
        <path
          id="neural-path"
          d="M 0 48 C 200 48, 200 16, 400 16 S 600 80, 800 80 S 1000 16, 1200 48"
          stroke="url(#neural-gradient)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: isInView ? 0 : pathLength,
            transition: `stroke-dashoffset 2s ${cubicBezierString(HEX_EASING)} 0.2s`,
          }}
        />
        {/* Data pulse dots */}
        {isInView && (
          <>
            <circle r="3" fill="#d946ef">
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                path="M 0 48 C 200 48, 200 16, 400 16 S 600 80, 800 80 S 1000 16, 1200 48"
              />
            </circle>
            <circle r="2" fill="#8b5cf6">
              <animateMotion
                dur="3s"
                repeatCount="indefinite"
                begin="1.5s"
                path="M 0 48 C 200 48, 200 16, 400 16 S 600 80, 800 80 S 1000 16, 1200 48"
              />
            </circle>
          </>
        )}
        <defs>
          <linearGradient id="neural-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
            <stop offset="25%" stopColor="#d946ef" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="1" />
            <stop offset="75%" stopColor="#d946ef" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.3" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
}

function cubicBezierString(values: readonly [number, number, number, number]) {
  return `cubic-bezier(${values.join(", ")})`;
}

// ─── Glow-Mesh Bento Card ───
function BentoCard({
  feature,
  index,
}: {
  feature: (typeof BENTO_FEATURES)[number];
  index: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(cardRef, { once: true, margin: "-50px" });
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const Icon = feature.icon;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: HEX_EASING,
      }}
      className={`glass-card relative overflow-hidden cursor-pointer ${feature.colSpan} ${feature.rowSpan} group`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Glow-mesh effect — follows cursor */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}% ${mousePos.y}%, ${feature.glowColor}, transparent 40%)`,
        }}
      />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "24px 24px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 md:p-8 h-full flex flex-col">
        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-all duration-300 ${
            isHovered ? "scale-110" : ""
          }`}
          style={{
            backgroundColor: feature.glowColor,
            border: `1px solid ${feature.glowColor.replace("0.15", "0.3")}`,
          }}
        >
          <Icon
            className="w-6 h-6"
            style={{
              color: feature.glowColor.replace("0.15", "0.9"),
            }}
          />
        </div>

        {/* Title */}
        <h3 className="font-silkscreen text-xs tracking-[0.15em] text-white mb-1">
          {feature.title}
        </h3>
        <span className="text-[10px] text-white/30 font-silkscreen tracking-[0.2em] mb-3">
          {feature.subtitle}
        </span>

        {/* Description */}
        <p className="text-sm text-white/50 leading-relaxed flex-1">
          {feature.description}
        </p>

        {/* Corner accents — Hex.tech style */}
        <div className="absolute top-3 left-3 w-2 h-2 border-t border-l border-white/10 group-hover:border-violet-400/40 transition-colors duration-300" />
        <div className="absolute top-3 right-3 w-2 h-2 border-t border-r border-white/10 group-hover:border-violet-400/40 transition-colors duration-300" />
        <div className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-white/10 group-hover:border-violet-400/40 transition-colors duration-300" />
        <div className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-white/10 group-hover:border-violet-400/40 transition-colors duration-300" />
      </div>

      {/* Bottom glow line on hover */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${feature.glowColor.replace("0.15", "0.6")}, transparent)`,
        }}
      />
    </motion.div>
  );
}

// ─── Protocol Stats Row ───
function ProtocolStats() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const stats = [
    { icon: Network, value: "3", label: "CONTRACTS", color: "#8b5cf6" },
    { icon: Coins, value: "ETH", label: "STAKING", color: "#d946ef" },
    { icon: FileCheck, value: "ERC", label: "8004 STD", color: "#10b981" },
    { icon: Sparkles, value: "0", label: "TRUST REQ", color: "#f59e0b" },
  ];

  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.4, delay: i * 0.1, ease: HEX_EASING }}
            className="glass-card p-4 flex items-center gap-3 group hover:border-violet-500/20 transition-all duration-300"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${stat.color}15` }}
            >
              <Icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <div
                className="font-silkscreen text-lg leading-none"
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
              <div className="font-silkscreen text-[8px] tracking-[0.2em] text-white/30 mt-0.5">
                {stat.label}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Main Export ───
export default function CovenantOverlay() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  const headerY = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const headerOpacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <section ref={sectionRef} className="relative z-20 py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <motion.div
          style={{ y: headerY, opacity: headerOpacity }}
          className="text-center mb-16"
        >
          <h2 className="font-silkscreen text-2xl sm:text-3xl text-white mb-4 tracking-[0.15em]">
            NEURAL COVENANT
          </h2>
          <p className="text-white/40 max-w-lg mx-auto text-sm">
            The autonomous enforcement layer. Agents discover, negotiate, and
            transact — all secured by immutable smart contracts.
          </p>
        </motion.div>

        {/* Protocol Stats */}
        <div className="mb-8">
          <ProtocolStats />
        </div>

        {/* Neural Pathway Connector 1 */}
        <NeuralPathway />

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[minmax(200px,auto)]">
          {BENTO_FEATURES.map((feature, i) => (
            <BentoCard key={feature.id} feature={feature} index={i} />
          ))}
        </div>

        {/* Neural Pathway Connector 2 */}
        <NeuralPathway />

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: HEX_EASING }}
          className="text-center mt-12"
        >
          <div className="inline-flex items-center gap-2 text-white/30 font-silkscreen text-[10px] tracking-[0.3em]">
            <span className="w-8 h-[1px] bg-gradient-to-r from-transparent to-violet-500/50" />
            PROTOCOL ACTIVE ON BASE SEPOLIA
            <span className="w-8 h-[1px] bg-gradient-to-l from-transparent to-violet-500/50" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
