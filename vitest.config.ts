import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Tests share one live Postgres database (Phase 1 migration away from in-memory
    // arrays) — run files sequentially so resetDemo()/seed state doesn't race across files.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
