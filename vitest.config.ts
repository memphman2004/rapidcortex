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
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.{test,spec}.{ts,tsx}", "apps/**/*.{test,spec}.{ts,tsx}"],
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
