import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        background: "#D8C9AE",
        surface: "#f0e8d8",
        "surface-alt": "#e5dcc9",
        foreground: "#1a1917",
        muted: "#7a7168",
        border: "rgba(26, 25, 23, 0.1)",
        "border-hover": "rgba(26, 25, 23, 0.2)",
        accent: "#575757",
        "accent-hover": "#3d3d3d",
        "accent-muted": "rgba(87, 87, 87, 0.1)",
        charcoal: "#575757",
        "charcoal-light": "#6b6b6b",
        success: "#16a34a",
        warning: "#d97706",
        danger: "#dc2626",
        info: "#0891b2",
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
        "pulse-sand": "pulseSand 2s ease-in-out infinite",
        grain: "grain 0.5s steps(1) infinite",
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
        pulseSand: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(87, 87, 87, 0.15)" },
          "50%": { boxShadow: "0 0 0 8px rgba(87, 87, 87, 0)" },
        },
        grain: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "10%": { transform: "translate(-2%, -2%)" },
          "20%": { transform: "translate(2%, 2%)" },
          "30%": { transform: "translate(-1%, 1%)" },
          "40%": { transform: "translate(1%, -1%)" },
          "50%": { transform: "translate(-2%, 2%)" },
          "60%": { transform: "translate(2%, -2%)" },
          "70%": { transform: "translate(-1%, -1%)" },
          "80%": { transform: "translate(1%, 1%)" },
          "90%": { transform: "translate(-2%, -2%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
