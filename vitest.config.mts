import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Testerna gäller den rena logiken: inga komponenter, ingen databas.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
