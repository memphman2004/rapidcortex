import { afterEach, describe, expect, it, vi } from "vitest";

describe("vertical transit flag", () => {
  const original = process.env.NEXT_PUBLIC_ENABLE_VERTICAL_TRANSIT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_ENABLE_VERTICAL_TRANSIT;
    } else {
      process.env.NEXT_PUBLIC_ENABLE_VERTICAL_TRANSIT = original;
    }
    vi.resetModules();
  });

  it("defaults the transit vertical on when the env var is unset", async () => {
    delete process.env.NEXT_PUBLIC_ENABLE_VERTICAL_TRANSIT;
    vi.resetModules();
    const { features, isVerticalEnabled } = await import("./features");
    expect(features.verticalTransit).toBe(true);
    expect(isVerticalEnabled("transit")).toBe(true);
  });
});
