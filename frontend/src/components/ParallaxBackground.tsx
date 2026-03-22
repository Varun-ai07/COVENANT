"use client";

import { useRef, useEffect, useCallback } from "react";

// ─── Parallax Layer Config ───
interface LayerConfig {
  src: string;
  speed: number; // parallax multiplier (0 = static, 1 = full)
  zIndex: number;
  opacity: number;
  blendMode?: string;
  scale?: number;
  translateY?: number;
}

const LAYERS: LayerConfig[] = [
  // Background: Starfield/nebula sky (slowest)
  {
    src: "/images/laven3.jpg", // starfield + nebula sky
    speed: 0.08,
    zIndex: 0,
    opacity: 0.7,
    scale: 1.15,
  },
  // Midground: Horizon glow + tree silhouette
  {
    src: "/images/laven4.jpg", // tree silhouette + horizon
    speed: 0.25,
    zIndex: 1,
    opacity: 0.85,
    scale: 1.1,
    translateY: -20,
  },
  // Foreground: Lavender field rows (fastest parallax)
  {
    src: "/images/laven1.jpg", // dramatic lavender rows
    speed: 0.5,
    zIndex: 2,
    opacity: 0.95,
    scale: 1.05,
  },
];

export default function ParallaxBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const targetX = useRef(0);
  const targetY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const rafRef = useRef<number>(0);

  // Smooth parallax animation loop
  const animate = useCallback(() => {
    // Lerp current position toward target
    currentX.current += (targetX.current - currentX.current) * 0.04;
    currentY.current += (targetY.current - currentY.current) * 0.04;

    layerRefs.current.forEach((layer, i) => {
      if (!layer) return;
      const config = LAYERS[i];
      const moveX = currentX.current * config.speed * 80;
      const moveY = currentY.current * config.speed * 60 + (config.translateY || 0);

      layer.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(${config.scale || 1})`;
    });

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    // Track mouse position for parallax
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2; // -1 to 1
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      targetX.current = x;
      targetY.current = y;
    };

    // Track device orientation for mobile parallax
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        targetX.current = Math.max(-1, Math.min(1, e.gamma / 30));
        targetY.current = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true });
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
      cancelAnimationFrame(rafRef.current);
    };
  }, [animate]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Vignette overlay for depth */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgba(10,1,24,0.7) 100%)`,
        }}
      />

      {/* Bottom fade to background */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(to top, #020617, transparent)`,
        }}
      />

      {/* Top fade */}
      <div
        className="absolute top-0 left-0 right-0 h-1/4 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(10,1,24,0.8), transparent)`,
        }}
      />

      {/* Parallax image layers */}
      {LAYERS.map((layer, i) => (
        <div
          key={i}
          ref={(el) => { layerRefs.current[i] = el; }}
          className="absolute inset-[-10%] will-change-transform"
          style={{
            zIndex: layer.zIndex,
            opacity: layer.opacity,
            backgroundImage: `url(${layer.src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            filter: i === 0 ? "brightness(0.5) saturate(1.3)" : "none",
            mixBlendMode: (layer.blendMode as React.CSSProperties["mixBlendMode"]) || "normal",
          }}
        />
      ))}

      {/* Animated mesh gradient overlay */}
      <div className="absolute inset-0 z-5 pointer-events-none mesh-gradient" />

      {/* Grid pattern for tech feel */}
      <div className="absolute inset-0 z-6 pointer-events-none grid-pattern opacity-30" />
    </div>
  );
}
