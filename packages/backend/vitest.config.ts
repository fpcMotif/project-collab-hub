import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "../convex/_generated/api.js": "../convex/_generated/api.ts",
      "../convex/_generated/dataModel.js": "../convex/_generated/dataModel.ts",
      "../convex/_generated/server.js": "../convex/_generated/server.ts",
      "./_generated/test-modules.js": "./_generated/test-modules.ts",
    },
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts", "convex-modules/**/*.test.ts"],
    server: { deps: { inline: ["convex-test"] } },
  },
});
