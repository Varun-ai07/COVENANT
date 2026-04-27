"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "./Navbar";
import { ToastProvider } from "./Toast";

const ParallaxBackground = dynamic(
  () => import("@/components/ParallaxBackground"),
  { ssr: false }
);

// Generate random particles for background effect
function Particles() {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; duration: number; size: number }>>([]);

  useEffect(() => {
    const generated = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 15,
      duration: 15 + Math.random() * 20,
      size: 1 + Math.random() * 2,
    }));
    setParticles(generated);
  }, []);

  return (
    <div className="particles pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            width: `${p.size}px`,
            height: `${p.size}px`,
          }}
        />
      ))}
    </div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {/* Global parallax background - shows on ALL pages */}
      <ParallaxBackground />

      {/* Floating particles overlay */}
      <Particles />

      {/* Navigation */}
      <Navbar />

      {/* Main content - z-index above background, pt-14 clears fixed navbar */}
      <main className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        {children}
      </main>
    </ToastProvider>
  );
}
