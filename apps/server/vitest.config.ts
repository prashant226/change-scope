import { defineConfig } from "vitest/config";

export default defineConfig({
  css: { postcss: { plugins: [] } },
  test: {
    include: ["tests-unit/**/*.test.ts"],
    css: false,
  },
});
