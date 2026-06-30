/** @type {import('tailwindcss').Config} */
import animate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "hsl(var(--bg))",
          elevated: "hsl(var(--bg-elevated))",
          surface: "hsl(var(--bg-surface))",
          hover: "hsl(var(--bg-hover))",
        },
        fg: {
          DEFAULT: "hsl(var(--fg))",
          muted: "hsl(var(--fg-muted))",
          subtle: "hsl(var(--fg-subtle))",
        },
        border: {
          DEFAULT: "hsl(var(--border))",
          subtle: "hsl(var(--border-subtle))",
          strong: "hsl(var(--border-strong))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          fg: "hsl(var(--accent-fg))",
          muted: "hsl(var(--accent-muted))",
          subtle: "hsl(var(--accent-subtle))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          fg: "0 0% 100%",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          fg: "0 0% 100%",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          fg: "hsl(var(--danger-fg))",
        },
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "var(--radius-sm)",
        sm: "var(--radius-xs)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        pop: "var(--shadow-pop)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [animate],
};
