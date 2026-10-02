import { describe, expect, it } from "vitest";
import { runSafetyGate } from "../safety-gate.js";

describe("runSafetyGate", () => {
  it("is emergency on gun regardless of surrounding non-emergency framing", () => {
    expect(runSafetyGate("he has a gun").isEmergency).toBe(true);
    expect(runSafetyGate("suspicious person outside").isEmergency).toBe(false);
  });
});
