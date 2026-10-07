import { describe, expect, it } from "vitest";
import { extractSlotsFromContext } from "./extract-slots-from-context.js";
import { remapLegacySmsSlots, sanitizeSlotsForIntent } from "./slot-catalog.js";

describe("extractSlotsFromContext", () => {
  it("does not attach ServiceAddress to PublicWorksIssue", () => {
    const next = extractSlotsFromContext(
      "PublicWorksIssue",
      "Corner of main and Johnson",
      { PublicWorksLocation: null, PublicWorksIssueType: null },
      {},
    );
    expect(next.ServiceAddress).toBeUndefined();
    expect(next.PublicWorksLocation?.value?.interpretedValue).toMatch(/Corner of main and Johnson/i);
  });

  it("fills ServiceAddress on ReportRoadsInfrastructure", () => {
    const next = extractSlotsFromContext(
      "ReportRoadsInfrastructure",
      "Corner of main and Johnson",
      {},
      {},
    );
    expect(next.ServiceAddress?.value?.interpretedValue).toMatch(/Corner of main and Johnson/i);
  });
});

describe("sanitizeSlotsForIntent", () => {
  it("drops 311 slots that Lex would reject on PublicWorksIssue", () => {
    const clean = sanitizeSlotsForIntent("PublicWorksIssue", {
      PublicWorksLocation: {
        value: { originalValue: "Main", interpretedValue: "Main", resolvedValues: ["Main"] },
      },
      ServiceAddress: {
        value: { originalValue: "Main", interpretedValue: "Main", resolvedValues: ["Main"] },
      },
      IsOngoing: {
        value: { originalValue: "HAPPENING_NOW", interpretedValue: "HAPPENING_NOW", resolvedValues: ["HAPPENING_NOW"] },
      },
    });
    expect(clean.ServiceAddress).toBeUndefined();
    expect(clean.IsOngoing).toBeUndefined();
    expect(clean.PublicWorksLocation?.value?.interpretedValue).toBe("Main");
  });
});

describe("remapLegacySmsSlots", () => {
  it("maps PublicWorksIssue location onto ReportRoadsInfrastructure", () => {
    const next = remapLegacySmsSlots("PublicWorksIssue", "ReportRoadsInfrastructure", {
      PublicWorksLocation: {
        value: {
          originalValue: "Corner of main and Johnson",
          interpretedValue: "Corner of main and Johnson",
          resolvedValues: ["Corner of main and Johnson"],
        },
      },
    });
    expect(next.ServiceAddress?.value?.interpretedValue).toMatch(/Corner of main and Johnson/i);
    expect(next.PublicWorksLocation).toBeUndefined();
  });
});
