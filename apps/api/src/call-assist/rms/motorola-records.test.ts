import { describe, expect, it } from "vitest";
import { submitMotorolaRecords } from "./motorola-records.js";

describe("Motorola Records live filing", () => {
  it("returns a mock report number in demo mode without calling the vendor", async () => {
    const result = await submitMotorolaRecords({
      demo: true,
      sessionId: "cas_session_demo",
      payload: {
        agencyId: "kcpd",
        classification: "REPORT_ONLY",
        intake: { summary: "Parking complaint" },
        location: { text: "12th and Main" },
      },
    });
    expect(result.ok).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.reportNumber).toMatch(/^MO-MOCK-/);
    expect(result.reason).toBe("demo_mock_rms");
  });
});
