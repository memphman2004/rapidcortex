import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Isolated C2C suite — no API handler env setup, no CAD write-back.
 * `@rc/*` aliases let tests run before workspace node_modules links exist.
 */
export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: {
      "@rc/common-codes": path.resolve(repoRoot, "packages/common-codes/src/index.ts"),
      "@rc/eido": path.resolve(repoRoot, "packages/eido/src/index.ts"),
      "@rc/c2c-hub": path.resolve(repoRoot, "packages/c2c-hub/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/common-codes/**/*.test.ts",
      "packages/eido/**/*.test.ts",
      "packages/c2c-hub/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
    passWithNoTests: false,
  },
});
