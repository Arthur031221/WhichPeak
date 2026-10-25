import { defineConfig } from "vitest/config";
import { serviceWorker } from "./scripts/swPlugin.ts";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "1" ? "/WhichPeak/" : "/",
  plugins: [serviceWorker()],
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
