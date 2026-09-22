import { describe, expect, it } from "vitest";
import { RING_INTEGRATION_ENABLED } from "./feature-flags.js";

describe("RING_INTEGRATION_ENABLED", () => {
  it("stays off until Ring developer program approval", () => {
    expect(RING_INTEGRATION_ENABLED).toBe(false);
  });
});
