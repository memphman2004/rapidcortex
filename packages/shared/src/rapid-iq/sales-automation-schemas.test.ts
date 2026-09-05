import { describe, expect, it } from "vitest";
import { normalizeSalesAutomationVertical } from "./sales-automation-schemas.js";

describe("normalizeSalesAutomationVertical", () => {
  it("maps CRM and intel aliases onto Rapid IQ sales verticals", () => {
    expect(normalizeSalesAutomationVertical("rc911")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("911")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("psap")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("campus")).toBe("CAMPUS");
    expect(normalizeSalesAutomationVertical("venue")).toBe("VENUE");
    expect(normalizeSalesAutomationVertical("hospital")).toBe("HOSPITAL");
    expect(normalizeSalesAutomationVertical("transit")).toBe("TRANSIT");
    expect(normalizeSalesAutomationVertical("airport")).toBe("TRANSIT");
    expect(normalizeSalesAutomationVertical("all")).toBe("ALL");
  });

  it("defaults unknown values to PSAP", () => {
    expect(normalizeSalesAutomationVertical("unknown")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical("")).toBe("PSAP");
    expect(normalizeSalesAutomationVertical(undefined)).toBe("PSAP");
  });
});
