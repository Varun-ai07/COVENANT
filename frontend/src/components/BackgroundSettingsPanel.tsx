"use client";

import { useState } from "react";
import { useBackgroundManager } from "@/components/BackgroundManager";

export default function BackgroundSettingsPanel() {
  const { config, updateConfig } = useBackgroundManager();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSettings = () => {
    setIsOpen(!isOpen);
  };

  const updateQuality = (quality: "low" | "medium" | "high") => {
    updateConfig({ quality });
  };

  const updateTheme = (theme: "lavender" | "nebula" | "cyber" | "minimal") => {
    updateConfig({ theme });
  };

  const toggleParticles = () => {
    updateConfig({ showParticles: !config.showParticles });
  };

  const toggle3D = () => {
    updateConfig({ show3D: !config.show3D });
  };

  const toggle2D = () => {
    updateConfig({ show2D: !config.show2D });
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={toggleSettings}
          className="w-12 h-12 rounded-full bg-violet-600/80 backdrop-blur-sm border border-violet-400/30 flex items-center justify-center text-white hover:bg-violet-500/80 transition-all duration-200 shadow-lg"
          aria-label="Background settings"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c.94-1.543-.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <div className="glass-card p-4 border border-white/10 backdrop-blur-sm rounded-xl shadow-xl w-80">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Background Settings</h3>
          <button
            onClick={toggleSettings}
            className="text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Quality Settings */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Quality</label>
            <div className="flex gap-2">
              {(["low", "medium", "high"] as const).map((quality) => (
                <button
                  key={quality}
                  onClick={() => updateQuality(quality)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    config.quality === quality
                      ? "bg-violet-600 text-white"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {quality.charAt(0).toUpperCase() + quality.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Settings */}
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Theme</label>
            <div className="flex flex-wrap gap-2">
              {(["lavender", "nebula", "cyber", "minimal"] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateTheme(theme)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    config.theme === theme
                      ? "bg-violet-600 text-white"
                      : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Settings */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Particles</span>
              <button
                onClick={toggleParticles}
                className={`w-12 h-6 rounded-full transition-all flex items-center ${
                  config.showParticles ? "bg-violet-600" : "bg-slate-600"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                    config.showParticles ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">3D Background</span>
              <button
                onClick={toggle3D}
                className={`w-12 h-6 rounded-full transition-all flex items-center ${
                  config.show3D ? "bg-violet-600" : "bg-slate-600"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                    config.show3D ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">2D Background</span>
              <button
                onClick={toggle2D}
                className={`w-12 h-6 rounded-full transition-all flex items-center ${
                  config.show2D ? "bg-violet-600" : "bg-slate-600"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transform transition-transform ${
                    config.show2D ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
