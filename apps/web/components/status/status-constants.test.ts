import { describe, expect, it } from "vitest";
import { STATUS_POLL_INTERVAL_MS } from "@/components/status/status-constants";

describe("status constants", () => {
  it("uses a 3-minute poll interval", () => {
    expect(STATUS_POLL_INTERVAL_MS).toBe(180_000);
  });
});
