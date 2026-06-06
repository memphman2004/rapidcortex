import { describe, expect, it } from "vitest";
import { formatUtcTimestamp } from "@/lib/rapid-cortex/status/format-utc-timestamp";

describe("formatUtcTimestamp", () => {
  it("formats ISO instants as YYYY-MM-DD HH:mm:ss UTC", () => {
    expect(formatUtcTimestamp("2026-05-02T00:05:00.000Z")).toBe("2026-05-02 00:05:00 UTC");
  });
});
