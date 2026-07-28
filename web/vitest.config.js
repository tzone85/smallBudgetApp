import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Standalone config for the web/ design-system tests.
// Run from the repo root with: npx vitest run -c web/vitest.config.js
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
});
