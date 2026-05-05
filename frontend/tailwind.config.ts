import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        "void-void": "#0a0118",
        "neural-dark": "#0d0221",
        "synapse-violet": "#8b5cf6",
        "plasma-pink": "#d946ef",
        "biolum-cyan": "#22d3ee",
        "neuron-gold": "#fbbf24",
        "lavender-ghost": "#c4b5fd",
        glass: "rgba(13, 2, 33, 0.6)",
        "glass-border": "rgba(139, 92, 246, 0.15)",
      },
      fontFamily: {
        heading: ["Cormorant Garamond", "Playfair Display", "Georgia", "serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
        body: ["DM Sans", "Outfit", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "neural-pulse": "neuralPulse 4s ease-in-out infinite",
        "breathe": "breathe 6s ease-in-out infinite",
        "shimmer": "shimmer 1.5s ease-in-out infinite",
        "float-up": "floatUp 0.6s ease-out forwards",
        "slide-diagonal": "slideDiagonal 0.4s ease-out",
        "mesh-drift": "meshDrift 30s ease-in-out infinite alternate",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px -5px rgba(139, 92, 246, 0.3)" },
          "50%": { boxShadow: "0 0 40px -5px rgba(139, 92, 246, 0.6), 0 0 80px -10px rgba(217, 70, 239, 0.3)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        neuralPulse: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.6" },
          "50%": { transform: "scale(1.02)", opacity: "0.8" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDiagonal: {
          "0%": { opacity: "0", transform: "translate(-10px, 10px)" },
          "100%": { opacity: "1", transform: "translate(0, 0)" },
        },
        meshDrift: {
          "0%": { transform: "scale(1) rotate(0deg)" },
          "100%": { transform: "scale(1.1) rotate(3deg)" },
        },
      },
      boxShadow: {
        "glow-violet": "0 0 30px -5px rgba(139, 92, 246, 0.4), 0 0 60px -10px rgba(139, 92, 246, 0.2)",
        "glow-pink": "0 0 30px -5px rgba(217, 70, 239, 0.4), 0 0 60px -10px rgba(217, 70, 239, 0.2)",
        "glow-cyan": "0 0 30px -5px rgba(34, 211, 238, 0.4), 0 0 60px -10px rgba(34, 211, 238, 0.2)",
        "glow-gold": "0 0 30px -5px rgba(251, 191, 36, 0.4), 0 0 60px -10px rgba(251, 191, 36, 0.2)",
        "card-neural": "0 20px 40px -20px rgba(10, 1, 24, 0.8), inset 0 0 30px -10px rgba(139, 92, 246, 0.05)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "neural": "20px 8px 20px 8px",
      },
      backdropBlur: {
        xs: "2px",
        sm: "4px",
        md: "8px",
        lg: "16px",
        xl: "24px",
      },
    },
  },
  plugins: [],
};

export default config;
