import { defineConfig } from "vitest/config";

// Argon2id hashing is deliberately slow; on a busy machine or CI runner the default 5s per test can be too tight.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 30_000 },
});
