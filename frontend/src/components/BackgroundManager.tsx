"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// Background quality settings
export type BackgroundQuality = "low" | "medium" | "high";
export type BackgroundTheme = "lavender" | "nebula" | "cyber" | "minimal";

// Background configuration
export interface BackgroundConfig {
  quality: BackgroundQuality;
  theme: BackgroundTheme;
  showParticles: boolean;
  show3D: boolean;
  show2D: boolean;
  particleCount: number;
  performanceMode: "performance" | "quality" | "balanced";
}

// Default configuration
export const defaultBackgroundConfig: BackgroundConfig = {
  quality: "high",
  theme: "lavender",
  showParticles: true,
  show3D: true,
  show2D: true,
  particleCount: 50,
  performanceMode: "balanced"
};

// Background manager hook
export function useBackgroundManager() {
  const [config, setConfig] = useState<BackgroundConfig>(defaultBackgroundConfig);
  const [fps, setFps] = useState<number | null>(null);
  const [isLowPerformance, setIsLowPerformance] = useState(false);
  const [userSetQuality, setUserSetQuality] = useState(false);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // FPS monitoring — called every frame
  const monitorFps = useCallback(() => {
    const currentTime = performance.now();
    frameCountRef.current++;

    if (frameCountRef.current % 60 === 0) {
      const elapsed = currentTime - lastTimeRef.current;
      if (elapsed > 0) {
        const currentFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(currentFps);

        // Auto-adjust quality based on FPS (only if user hasn't manually set it)
        if (!userSetQuality) {
          if (currentFps < 30) {
            setIsLowPerformance(true);
            setConfig(prev => ({ ...prev, quality: "low" }));
          } else if (currentFps > 50) {
            setIsLowPerformance(false);
            setConfig(prev => ({ ...prev, quality: "high" }));
          }
        }
      }
      frameCountRef.current = 0;
      lastTimeRef.current = currentTime;
    }
  }, [userSetQuality]);

  // Animation frame loop to drive monitorFps
  useEffect(() => {
    let raf: number;
    const tick = () => {
      monitorFps();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [monitorFps]);

  // Update configuration
  const updateConfig = (newConfig: Partial<BackgroundConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    // Track if user manually set quality
    if (newConfig.quality !== undefined) {
      setUserSetQuality(true);
    }
  };

  return {
    config,
    fps,
    isLowPerformance,
    updateConfig,
    monitorFps,
  };
}
