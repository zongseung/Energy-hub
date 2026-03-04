/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Hyperbeat Trader exact palette
        hb: {
          bg: "#0b0b0e",
          surface: "#111116",
          panel: "#16161d",
          border: "#1e1e28",
          "border-light": "#2a2a38",
        },
        text: {
          primary: "#ffffff",
          secondary: "#8b8b9b",
          muted: "#5b5b6b",
          label: "#6e6e7e",
        },
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
