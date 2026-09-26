import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "apps/web"),
      "rapid-cortex-shared": path.resolve(repoRoot, "packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/shared/src/milestone/**/*.test.ts",
      "apps/api/src/integrations/milestone/**/*.test.ts",
      "apps/web/lib/runtime-flags.milestone.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    fileParallelism: false,
  },
});
