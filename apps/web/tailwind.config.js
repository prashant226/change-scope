/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        "primary-dark": "#1D4ED8",
        "primary-light": "#EFF6FF",
        ink: "#111827",
        muted: "#64748B",
        soft: "#F8FAFC",
        border: "#E5E7EB",
        high: "#DC2626",
        medium: "#D97706",
        low: "#16A34A",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(17 24 39 / 0.04), 0 1px 3px 0 rgb(17 24 39 / 0.06)",
        "card-hover": "0 4px 6px -1px rgb(17 24 39 / 0.06), 0 2px 4px -2px rgb(17 24 39 / 0.06)",
        popover: "0 10px 15px -3px rgb(17 24 39 / 0.08), 0 4px 6px -4px rgb(17 24 39 / 0.08)",
      },
      borderRadius: {
        xl: "0.75rem",
      },
    },
  },
  plugins: [],
};
