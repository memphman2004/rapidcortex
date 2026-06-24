import { describe, expect, it } from "vitest";
import type { Incident, TranscriptSegment } from "rapid-cortex-shared";
import {
  callerLanguageNeedsTranslation,
  inferCallerLanguageFromSegments,
  resolveIncidentCallerLanguage,
} from "./caller-language";

describe("caller-language helpers", () => {
  it("infers from latest caller segment", () => {
    const segments: TranscriptSegment[] = [
      {
        segmentId: "s1",
        incidentId: "i1",
        agencyId: "a1",
        speaker: "caller",
        text: "Hello",
        timestamp: "2026-01-01T00:00:00.000Z",
        originalLanguage: "en",
      },
      {
        segmentId: "s2",
        incidentId: "i1",
        agencyId: "a1",
        speaker: "caller",
        text: "Ayuda",
        timestamp: "2026-01-01T00:00:01.000Z",
        detectedLanguage: "es",
      },
    ];
    expect(inferCallerLanguageFromSegments(segments)).toBe("es");
  });

  it("prefers incident callerLanguage over inference", () => {
    const incident = { callerLanguage: "vi" } as Incident;
    const segments: TranscriptSegment[] = [
      {
        segmentId: "s1",
        incidentId: "i1",
        agencyId: "a1",
        speaker: "caller",
        text: "Hola",
        timestamp: "2026-01-01T00:00:00.000Z",
        detectedLanguage: "es",
      },
    ];
    expect(resolveIncidentCallerLanguage(incident, segments)).toBe("vi");
  });

  it("knows when translation is needed", () => {
    expect(callerLanguageNeedsTranslation("es")).toBe(true);
    expect(callerLanguageNeedsTranslation("en")).toBe(false);
    expect(callerLanguageNeedsTranslation(null)).toBe(false);
  });
});
