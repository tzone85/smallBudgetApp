import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.js"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      // ui.js is DOM-binding glue covered by Playwright e2e tests, not vitest.
      // main.js is the entrypoint (composition).
      exclude: ["src/main.js", "src/ui.js"],
      reporter: ["text", "html"],
      thresholds: {
        lines: 85,
        branches: 80,
        functions: 85,
        statements: 85,
      },
    },
  },
});
