import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Integration tests share one database (e.g. job expiry touches every job), so test
    // files run one after another to keep results deterministic.
    fileParallelism: false,
    exclude: ["e2e/**", "node_modules/**"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
});

