import { describe, expect, it } from "vitest";
import { callAssistCasePrefix, formatCallAssistCaseNumber } from "./case-number.js";

describe("Call Assist case numbers", () => {
  it("uses KCNE for KCPD", () => {
    expect(callAssistCasePrefix("kcpd")).toBe("KCNE");
    const id = formatCallAssistCaseNumber({
      agencyId: "kcpd",
      at: new Date("2026-09-16T16:20:36Z"),
      timeZone: "America/Chicago",
      serial: "847291036512",
    });
    expect(id).toBe("KCNE-09/16/2026-11:20:36-847291036512");
  });

  it("pads a short serial to 12 digits", () => {
    const id = formatCallAssistCaseNumber({
      agencyId: "kcpd",
      at: new Date("2026-01-02T12:00:00Z"),
      timeZone: "UTC",
      serial: "42",
    });
    expect(id).toMatch(/^KCNE-01\/02\/2026-12:00:00-000000000042$/);
  });
});
