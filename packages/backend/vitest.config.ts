import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "./_generated/dataModel": "../convex/_generated/dataModel",
      "./_generated/server": "../convex/_generated/server",
    },
    environment: "edge-runtime",
    include: ["tests/**/*.test.ts"],
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
});
