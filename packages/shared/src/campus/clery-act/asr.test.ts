import { describe, expect, it } from "vitest";
import { ASR_DISCLAIMER_TEMPLATE, formatAsrDisclaimer, generateAsrStatistics } from "./asr.js";
import type { CleryRecord } from "./schemas.js";

function rec(over: Partial<CleryRecord>): CleryRecord {
  return {
    recordId: over.recordId ?? "r1",
    agencyId: "campus-uga",
    incidentId: "i1",
    campusCode: "UGA",
    primaryOffense: "BURGLARY",
    secondaryOffenses: [],
    isHateCrime: false,
    hateCrimeBiasCategories: [],
    isVAWAOffense: false,
    enforcementAction: "NONE",
    cleryGeography: "ON_CAMPUS",
    isResidentialFacility: false,
    generalLocationDescription: "Parking Garage B",
    reportedToInstitutionAt: "2025-03-01T12:00:00.000Z",
    occurredAtApproximate: false,
    reportingCalendarYear: 2025,
    status: "CLASSIFIED",
    classificationVersion: 1,
    classificationHistory: [],
    inDailyCrimeLog: true,
    dailyCrimeLogDeadline: "2025-03-04T23:59:59.999Z",
    dailyCrimeLogOverdue: false,
    timelyWarningAssessed: true,
    includedInASR: true,
    createdAt: "2025-03-01T12:00:00.000Z",
    updatedAt: "2025-03-01T12:00:00.000Z",
    ...over,
  };
}

describe("ASR statistics generator", () => {
  it("counts only CLASSIFIED records in offense totals", () => {
    const stats = generateAsrStatistics(
      [
        rec({ recordId: "a", status: "CLASSIFIED" }),
        rec({ recordId: "b", status: "PENDING_REVIEW" }),
        rec({ recordId: "c", status: "EXCLUDED" }),
        rec({ recordId: "d", status: "PENDING_INFORMATION" }),
      ],
      [2025],
    );
    const burglary = stats.offenses.find((r) => r.offenseCategory === "BURGLARY" && r.calendarYear === 2025);
    expect(burglary?.onCampus).toBe(1);
    expect(burglary?.unfounded).toBe(0);
  });

  it("counts UNFOUNDED separately and never in offense totals", () => {
    const stats = generateAsrStatistics(
      [
        rec({ recordId: "a", status: "CLASSIFIED" }),
        rec({ recordId: "b", status: "UNFOUNDED" }),
      ],
      [2025],
    );
    const burglary = stats.offenses.find((r) => r.offenseCategory === "BURGLARY" && r.calendarYear === 2025);
    expect(burglary?.onCampus).toBe(1);
    expect(burglary?.unfounded).toBe(1);
  });

  it("counts residential as a subset of on campus", () => {
    const stats = generateAsrStatistics(
      [
        rec({
          recordId: "a",
          cleryGeography: "ON_CAMPUS_RESIDENTIAL",
          isResidentialFacility: true,
          primaryOffense: "RAPE",
        }),
      ],
      [2025],
    );
    const rape = stats.offenses.find((r) => r.offenseCategory === "RAPE");
    expect(rape?.onCampus).toBe(1);
    expect(rape?.onCampusResidential).toBe(1);
  });

  it("embeds the Part 6.3 disclaimer with institution name", () => {
    const text = formatAsrDisclaimer("Craven Community College");
    expect(text).toContain("Craven Community College");
    expect(text).toContain("This report does not constitute legal advice");
    expect(ASR_DISCLAIMER_TEMPLATE).toContain("{{institutionName}}");
    expect(text).not.toContain("{{institutionName}}");
  });
});
