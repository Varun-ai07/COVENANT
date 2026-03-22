"use client";

import { useEffect, useState, useRef } from "react";
import { cameraState } from "@/components/LavenderWorld";

// ─── Neural Link Status Bar ───
function NeuralLinkBar() {
  const [depth, setDepth] = useState(0.5);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setDepth(cameraState.t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Interpolate between Plasma Pink and Deep Amethyst based on camera depth
  const lerpColor = (t: number) => {
    // Pink: #d946ef → Amethyst: #4c1d95
    const r = Math.round(217 - (217 - 76) * t);
    const g = Math.round(70 - (70 - 29) * t);
    const b = Math.round(239 - (239 - 149) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const barColor = lerpColor(depth);
  const statusLabel = depth < 0.33 ? "SURFACE" : depth < 0.66 ? "IMMERSION" : "DEPTH";

  return (
    <div
      ref={barRef}
      className="fixed top-0 left-0 right-0 z-50 h-1"
      role="status"
      aria-label={`Neural link status: ${statusLabel}, depth ${(depth * 100).toFixed(0)}%`}
    >
      <div
        className="h-full transition-colors duration-500"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${barColor} 30%, ${barColor} 70%, transparent 100%)`,
          boxShadow: `0 0 12px ${barColor}, 0 0 24px ${barColor}40`,
        }}
      />
    </div>
  );
}

// ─── Depth Readout ───
function DepthReadout() {
  const [z, setZ] = useState(2.5);
  const [t, setT] = useState(0.5);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      setZ(cameraState.z);
      setT(cameraState.t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="fixed bottom-6 left-6 z-40 select-none"
      role="complementary"
      aria-label="Camera depth readout"
    >
      <div className="glass-card px-4 py-3 font-mono text-xs space-y-1.5">
        <div className="flex items-center gap-2 text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          NEURAL LINK ACTIVE
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-violet-400">Z</span>
          <span className="text-white font-semibold text-sm tabular-nums">
            {z.toFixed(2)}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-violet-400">DEPTH</span>
          <span className="text-white font-semibold text-sm tabular-nums">
            {(t * 100).toFixed(0)}%
          </span>
        </div>
        {/* Mini depth bar */}
        <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${t * 100}%`,
              background: `linear-gradient(90deg, #d946ef, #4c1d95)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── FPS Counter ───
function FpsCounter({ fps }: { fps: number | null }) {
  if (fps === null) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 select-none"
      role="status"
      aria-label={`Frame rate: ${fps} frames per second`}
    >
      <div className="glass-card px-3 py-2 font-mono text-xs">
        <span className={fps < 50 ? "text-amber-400" : "text-emerald-400"}>
          {fps} FPS
        </span>
      </div>
    </div>
  );
}

// ─── Brand Identity (bottom-right) ───
function BrandMark() {
  return (
    <div
      className="fixed top-6 right-6 z-40 select-none"
      role="banner"
      aria-label="COVENANT protocol"
    >
      <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity duration-300">
        <svg
          className="w-5 h-5 text-violet-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        <span className="font-silkscreen text-xs text-slate-500 tracking-wider">
          PROTOCOL v1
        </span>
      </div>
    </div>
  );
}

// ─── Main Overlay Export ───
interface InterfaceOverlayProps {
  fps?: number | null;
  children?: React.ReactNode;
}

export default function InterfaceOverlay({ fps = null, children }: InterfaceOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-hidden={false}>
      {/* Top bar: Neural Link status */}
      <NeuralLinkBar />

      {/* Brand mark */}
      <BrandMark />

      {/* Bottom-left: Depth readout */}
      <DepthReadout />

      {/* Bottom-right: FPS counter */}
      <FpsCounter fps={fps} />

      {/* Slot for additional UI (pointer-events-auto on children) */}
      {children && (
        <div className="pointer-events-auto">
          {children}
        </div>
      )}
    </div>
  );
}
