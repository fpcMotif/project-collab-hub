import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  // Ensure that import.meta.glob will include the _generated folder
});
