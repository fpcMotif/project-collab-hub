import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "../convex/_generated/api.js": "../convex/_generated/api.ts",
    },
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts", "convex-modules/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
