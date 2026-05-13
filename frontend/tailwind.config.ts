import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Dark theme base
        background: "#01011b",
        "background-alt": "#080818",
        surface: "#0a0a2e",
        "surface-alt": "#0d0d35",
        foreground: "#ffffff",
        muted: "#9ca3af",
        "muted-dark": "#6b7280",
        border: "rgba(255, 255, 255, 0.08)",
        "border-light": "rgba(255, 255, 255, 0.12)",

        // Violet accent system
        accent: "#7c3aed",
        "accent-light": "#a78bfa",
        "accent-glow": "#6d28d9",
        "accent-muted": "rgba(124, 58, 237, 0.1)",

        // Semantic colors
        success: "#10b981",
        warning: "#d97706",
        danger: "#dc2626",
        info: "#0891b2",

        // Chart colors
        violet: "#7c3aed",
        teal: "#14b8a6",
        pink: "#ec4899",
        blue: "#3b82f6",
      },
      fontFamily: {
        heading: ["Orbitron", "system-ui", "sans-serif"],
        accent: ["Space Mono", "monospace"],
        body: ["Space Grotesk Variable", "system-ui", "sans-serif"],
        mono: ["Space Mono", "Fira Code", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "fade-in-up": "fadeInUp 0.3s ease-out forwards",
        "slide-up": "slideUp 0.2s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        scroll: "scroll 30s linear infinite",
        float: "float 4s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
        "gradient-shift": "gradientShift 8s ease infinite",
        "border-dance": "borderDance 3s linear infinite",
        "text-shimmer": "textShimmer 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        scroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(109, 40, 217, 0.2)" },
          "50%": { boxShadow: "0 0 40px rgba(109, 40, 217, 0.4)" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        borderDance: {
          "0%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "300% 0%" },
        },
        textShimmer: {
          "0%, 100%": { opacity: "0.8" },
          "50%": { opacity: "1" },
        },
      },
      boxShadow: {
        glow: "0 0 60px rgba(109, 40, 217, 0.2)",
        "glow-lg": "0 0 80px rgba(109, 40, 217, 0.25)",
        "glow-sm": "0 0 30px rgba(109, 40, 217, 0.15)",
        "elevated": "0 8px 32px -8px rgba(0, 0, 0, 0.5), 0 4px 16px -4px rgba(0, 0, 0, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
