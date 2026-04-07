import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
  resolve: {
    alias: {
      "../convex/_generated/api.js": "../convex/_generated/api.ts",
      "../convex/_generated/server.js": "../convex/_generated/server.ts",
      "../convex/_generated/dataModel.js": "../convex/_generated/dataModel.ts",
    },
  },
});
