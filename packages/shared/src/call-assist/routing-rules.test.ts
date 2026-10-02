import { describe, expect, it } from "vitest";
import {
  defaultCallAssistRoutingRules,
  evaluateCallAssistRouting,
  matchesCallAssistTimeWindow,
} from "./routing-rules.js";

describe("Call Assist routing rules", () => {
  const rules = defaultCallAssistRoutingRules("kcpd");

  it("routes suspicious vehicle to PATROL", () => {
    const result = evaluateCallAssistRouting({
      agencyId: "kcpd",
      confirmationNumber: "KC-1001-7M4R",
      incidentType: "SUSPICIOUS_VEHICLE",
      createdAt: "2026-10-01T14:30:00.000Z",
      rules,
    });
    expect(result.departmentId).toBe("PATROL");
    expect(result.ruleId).toBe("suspicious-vehicle-patrol");
    expect(result.fallback).toBe(false);
  });

  it("falls back to SUPERVISOR when nothing matches", () => {
    const result = evaluateCallAssistRouting({
      agencyId: "kcpd",
      confirmationNumber: "KC-1001-AAAA",
      incidentType: "UNKNOWN_TYPE_XYZ",
      createdAt: "2026-10-01T14:30:00.000Z",
      rules,
    });
    expect(result.departmentId).toBe("SUPERVISOR");
    expect(result.ruleId).toBe("DEFAULT_FALLBACK");
    expect(result.fallback).toBe(true);
  });

  it("matches Chicago business-hours window", () => {
    // Wednesday 2026-09-30 15:00 CDT = 20:00 UTC
    expect(
      matchesCallAssistTimeWindow(
        {
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: "08:00",
          endTime: "17:00",
          timezone: "America/Chicago",
        },
        "2026-09-30T20:00:00.000Z",
      ),
    ).toBe(true);
  });
});
