/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Theme-varying colors (CSS variables as RGB triplets for Tailwind opacity support)
        hb: {
          bg: "rgb(var(--hb-bg) / <alpha-value>)",
          surface: "rgb(var(--hb-surface) / <alpha-value>)",
          panel: "rgb(var(--hb-panel) / <alpha-value>)",
          border: "rgb(var(--hb-border) / <alpha-value>)",
          "border-light": "rgb(var(--hb-border-light) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
          label: "rgb(var(--text-label) / <alpha-value>)",
        },
        // Accent colors stay hardcoded (same in both themes, Tailwind opacity modifiers work)
        accent: {
          green: "#0ecb81",
          red: "#f6465d",
          blue: "#2962ff",
          cyan: "#00b8d9",
          amber: "#f0b90b",
          purple: "#a855f7",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', '"SF Mono"', "monospace"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
    },
  },
  plugins: [],
};
