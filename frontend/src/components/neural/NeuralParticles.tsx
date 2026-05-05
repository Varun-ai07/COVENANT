"use client";

import { useMemo } from "react";

interface NeuralParticlesProps {
  count?: number;
  className?: string;
}

const colors = ["bg-synapse-violet", "bg-plasma-pink", "bg-biolum-cyan"];

export default function NeuralParticles({
  count = 30,
  className = "",
}: NeuralParticlesProps) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: 2 + Math.random() * 4,
      height: 2 + Math.random() * 4,
      animationDelay: `${Math.random() * 8}s`,
      animationDuration: `${6 + Math.random() * 10}s`,
      color: colors[Math.floor(Math.random() * colors.length)],
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, [count]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={`absolute rounded-full ${particle.color} animate-float-up`}
          style={{
            left: particle.left,
            top: particle.top,
            width: particle.width,
            height: particle.height,
            animationDelay: particle.animationDelay,
            animationDuration: particle.animationDuration,
            opacity: particle.opacity,
          }}
        />
      ))}
    </div>
  );
}
