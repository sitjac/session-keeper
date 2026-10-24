import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@session-keeper/core": path.resolve("packages/core/src/index.ts"),
      "@session-keeper/shared": path.resolve("packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
