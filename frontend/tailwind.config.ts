import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // ═══════════════════════════════════════════════════════════════
      // COLORS — Dark Mode Obsidian + Light Mode Milk
      // ═══════════════════════════════════════════════════════════════
      colors: {
        // Base substrate
        background: {
          DEFAULT: "var(--background)",
          alt: "var(--background-alt)",
        },
        surface: {
          DEFAULT: "var(--surface)",
          alt: "var(--surface-alt)",
          elevated: "var(--surface-elevated)",
        },

        // Foreground
        foreground: {
          DEFAULT: "var(--foreground)",
          muted: "var(--foreground-muted)",
          dim: "var(--foreground-dim)",
        },

        // Borders (hairline-thin, semi-transparent)
        border: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
          accent: "var(--border-accent)",
        },

        // Accent — Surgical Emerald (AI focus states ONLY)
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          glow: "var(--accent-glow)",
        },

        // Semantic colors (muted)
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#06B6D4",
      },

      // ═══════════════════════════════════════════════════════════════
      // TYPOGRAPHY — Swiss Industrial
      // ═══════════════════════════════════════════════════════════════
      fontFamily: {
        // Macro typography — Heavy sans for headings
        heading: ["var(--font-satoshi)", "Inter", "system-ui", "sans-serif"],

        // Body text — Refined grotesk
        body: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],

        // Micro typography — Monospace for ALL metadata
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "Space Mono", "monospace"],
      },

      fontSize: {
        // Massive display type
        "display-xl": ["clamp(4rem, 12vw, 10rem)", { lineHeight: "0.9", letterSpacing: "-0.04em" }],
        "display-lg": ["clamp(3rem, 8vw, 7rem)", { lineHeight: "0.95", letterSpacing: "-0.03em" }],
        "display-md": ["clamp(2rem, 5vw, 4rem)", { lineHeight: "1", letterSpacing: "-0.02em" }],

        // Standard hierarchy
        "heading-xl": ["clamp(1.75rem, 4vw, 3rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "heading-lg": ["clamp(1.5rem, 3vw, 2.25rem)", { lineHeight: "1.2", letterSpacing: "-0.01em" }],
        "heading-md": ["clamp(1.25rem, 2vw, 1.5rem)", { lineHeight: "1.3" }],

        // Body
        "body-lg": ["1.125rem", { lineHeight: "1.7" }],
        "body-md": ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],

        // Micro (monospace metadata)
        "micro-lg": ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        "micro-md": ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.03em" }],
        "micro-sm": ["0.625rem", { lineHeight: "1.2", letterSpacing: "0.04em" }],
      },

      // ═══════════════════════════════════════════════════════════════
      // BORDER RADIUS — Modular Canvases
      // ═══════════════════════════════════════════════════════════════
      borderRadius: {
        "none": "0",
        "sm": "0.25rem",
        "DEFAULT": "0.5rem",
        "md": "0.75rem",
        "lg": "1rem",
        "xl": "1.25rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
        "4xl": "3rem",
      },

      // ═══════════════════════════════════════════════════════════════
      // SHADOWS — Flat Elevation Only
      // ═══════════════════════════════════════════════════════════════
      boxShadow: {
        "none": "none",
        "sm": "0 1px 2px rgba(0, 0, 0, 0.02)",
        "DEFAULT": "0 1px 3px rgba(0, 0, 0, 0.03)",
        "elevated": "0 4px 20px rgba(0, 0, 0, 0.08)",
        "glow-accent": "0 0 40px var(--accent-glow)",
        "glow-accent-intense": "0 0 60px rgba(0, 255, 136, 0.2)",
        "inner-highlight": "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
      },

      // ═══════════════════════════════════════════════════════════════
      // MOTION — Fluid Dynamics
      // ═══════════════════════════════════════════════════════════════
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.32, 0.72, 0, 1)",
        "bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },

      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
        "1200": "1200ms",
      },

      animation: {
        "fade-in": "fadeIn 0.6s var(--ease-spring) forwards",
        "fade-up": "fadeUp 0.8s var(--ease-spring) forwards",
        "slide-in-left": "slideInLeft 0.7s var(--ease-spring) forwards",
        "slide-in-right": "slideInRight 0.7s var(--ease-spring) forwards",
        "scale-in": "scaleIn 0.5s var(--ease-spring) forwards",
        "glow-pulse": "glowPulse 3s ease-in-out infinite",
        "border-flow": "borderFlow 4s linear infinite",
        "text-reveal": "textReveal 1s var(--ease-spring) forwards",
        "grid-loading": "gridLoading 1.5s var(--ease-spring) infinite",
        "ping-slow": "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
        "scroll": "scroll 30s linear infinite",
      },

      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)", filter: "blur(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)", filter: "blur(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-32px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(32px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0, 255, 136, 0.1)" },
          "50%": { boxShadow: "0 0 40px rgba(0, 255, 136, 0.2)" },
        },
        borderFlow: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        textReveal: {
          "0%": { clipPath: "inset(0 100% 0 0)" },
          "100%": { clipPath: "inset(0 0 0 0)" },
        },
        gridLoading: {
          "0%": { opacity: "0.3", transform: "scale(0.98)" },
          "50%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0.3", transform: "scale(0.98)" },
        },
        ping: {
          "75%, 100%": { transform: "scale(2)", opacity: "0" },
        },
        scroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },

      // ═══════════════════════════════════════════════════════════════
      // SPACING — Macro Whitespace
      // ═══════════════════════════════════════════════════════════════
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
        "34": "8.5rem",
        "38": "9.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
