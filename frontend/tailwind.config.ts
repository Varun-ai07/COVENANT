import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        "glass": "rgba(15, 23, 42, 0.5)",
        "glass-border": "rgba(148, 163, 184, 0.08)",
        "accent-violet": "#8b5cf6",
        "accent-purple": "#a855f7",
        "accent-emerald": "#10b981",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-in-up": "fadeInUp 0.6s ease-out",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "shimmer": "shimmer 1.5s ease-in-out infinite",
        "float": "float linear infinite",
        "mesh-move": "meshMove 20s ease-in-out infinite alternate",
        "slide-down": "slideDown 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeInUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px -5px rgba(139, 92, 246, 0.2)" },
          "50%": { boxShadow: "0 0 30px -5px rgba(139, 92, 246, 0.4)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "glow-violet": "0 0 20px -5px rgba(139, 92, 246, 0.3), 0 0 40px -10px rgba(139, 92, 246, 0.2)",
        "glow-emerald": "0 0 20px -5px rgba(16, 185, 129, 0.3), 0 0 40px -10px rgba(16, 185, 129, 0.2)",
        "glass": "0 8px 32px rgba(0, 0, 0, 0.3)",
        "card": "0 20px 40px -20px rgba(0, 0, 0, 0.5)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
      fontFamily: {
        "silkscreen": ['"Silkscreen"', "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
