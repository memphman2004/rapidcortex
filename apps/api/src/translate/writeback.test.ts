import { describe, expect, it } from "vitest";
import { hasWritebackTarget } from "./writeback.js";
import type { TranslateSession } from "rapid-cortex-shared";

function session(over: Partial<TranslateSession> = {}): TranslateSession {
  return {
    sessionId: "xlat_1",
    agencyId: "kcpd",
    officerId: "u1",
    primaryLanguage: "en",
    subjectLanguage: "es",
    subjectLanguageDetected: true,
    status: "ACTIVE",
    startedAt: "2026-09-08T00:00:00.000Z",
    segmentCount: 1,
    cadWritebackStatus: "NONE",
    monitorUserIds: [],
    sessionUrl: "https://app.example.test/translate/xlat_1",
    vertical: "law_enforcement",
    createdAt: "2026-09-08T00:00:00.000Z",
    updatedAt: "2026-09-08T00:00:00.000Z",
    ...over,
  };
}

describe("translate write-back targets", () => {
  it("requires an incident for law enforcement", () => {
    expect(hasWritebackTarget(session(), "law_enforcement")).toBe(false);
    expect(hasWritebackTarget(session({ incidentId: "inc-1" }), "law_enforcement")).toBe(true);
  });

  it("routes venue and hospital to their context ids", () => {
    expect(
      hasWritebackTarget(
        session({ vertical: "venue", venueContext: { venueCode: "MBS", venueIncidentId: "v1" } }),
        "venue",
      ),
    ).toBe(true);
    expect(
      hasWritebackTarget(
        session({
          vertical: "hospital",
          hospitalContext: { hospitalId: "h1", patientEncounterId: "e1" },
        }),
        "hospital",
      ),
    ).toBe(true);
  });
});
