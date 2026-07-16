import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    globals: false,
    // Real OMR, compiler, and governance tests can each occupy a worker for
    // minutes. Bounding file concurrency keeps Vitest's main-thread RPC
    // responsive while those external-tool tests run together.
    maxWorkers: 4,
    testTimeout: 30_000,
  },
});
