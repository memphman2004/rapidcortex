import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Ensure globs (`apps/**`, `packages/**`) resolve from the repo root when Vitest is launched from app workspaces (e.g. `apps/web`).
  root: repoRoot,
  resolve: {
    alias: {
      "@": path.resolve(repoRoot, "apps/web"),
      "rapid-cortex-integrations/cad": path.resolve(repoRoot, "packages/integrations/cad/index.ts"),
      "rapid-cortex-shared/auth/rapid-cortex-roles": path.resolve(
        repoRoot,
        "packages/shared/src/auth/rapid-cortex-roles.ts",
      ),
      "rapid-cortex-shared/tenancy/principal": path.resolve(
        repoRoot,
        "packages/shared/src/tenancy/principal.ts",
      ),
      "rapid-cortex-shared/types": path.resolve(repoRoot, "packages/shared/src/types.ts"),
      "rapid-cortex-shared": path.resolve(repoRoot, "packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: [
      "packages/**/*.{test,spec}.{ts,tsx}",
      "apps/**/*.{test,spec}.{ts,tsx}",
      "scripts/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
    ],
    passWithNoTests: false,
    setupFiles: ["./apps/api/src/handlers/vitest-handler-env.setup.ts"],
  },
});
