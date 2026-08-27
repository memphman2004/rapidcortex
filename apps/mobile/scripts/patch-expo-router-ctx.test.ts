import { describe, expect, it } from "vitest";
import { rewriteExpoRouterCtxSource } from "./patch-expo-router-ctx.js";

const SAMPLE = `export const ctx = require.context(
  process.env.EXPO_ROUTER_APP_ROOT,
  true,
  /^(?:\\.\\/).*\\.tsx$/,
  process.env.EXPO_ROUTER_IMPORT_MODE
);
`;

describe("patch expo-router ctx for Metro require.context", () => {
  it("replaces env lookups with string literals", () => {
    const out = rewriteExpoRouterCtxSource(SAMPLE, "../../app");
    expect(out).toContain('require.context(\n  "../../app"');
    expect(out).toContain('"sync"');
    expect(out).not.toContain("process.env.EXPO_ROUTER_APP_ROOT");
    expect(out).not.toContain("process.env.EXPO_ROUTER_IMPORT_MODE");
  });

  it("is a no-op once already patched", () => {
    const once = rewriteExpoRouterCtxSource(SAMPLE, "../../app");
    const twice = rewriteExpoRouterCtxSource(once, "../../app");
    expect(twice).toBe(once);
  });
});
