/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2563EB",
        ink: "#111827",
        muted: "#64748B",
        soft: "#F8FAFC",
        border: "#E5E7EB",
        high: "#DC2626",
        medium: "#D97706",
        low: "#16A34A",
      },
    },
  },
  plugins: [],
};
