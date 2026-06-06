import { describe, it, expect, vi, afterEach } from "vitest";
import { formatTime, formatRelativeOpened } from "./format.js";

describe("formatTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a valid ISO timestamp", () => {
    const s = formatTime("2026-04-20T15:30:00.000Z");
    expect(s).not.toBe("—");
    expect(s.length).toBeGreaterThan(4);
  });

  it("returns em dash for invalid input", () => {
    expect(formatTime("not-a-date")).toBe("—");
  });
});

describe("formatRelativeOpened", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows seconds for very recent opens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:30.000Z"));
    expect(formatRelativeOpened("2026-04-20T12:00:10.000Z")).toMatch(/20s ago/);
  });
});
