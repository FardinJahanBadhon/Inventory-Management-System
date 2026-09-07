import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./tests/setup.ts"],
    // Integration tests share one real Postgres test database and reset
    // it between tests (see tests/setup.ts) — running test files in
    // parallel would let them stomp on each other's data, so the whole
    // suite runs as a single sequential process instead.
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 20000,
  },
});
