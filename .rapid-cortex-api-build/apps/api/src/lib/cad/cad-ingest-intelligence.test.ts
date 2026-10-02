import { describe, expect, it } from "vitest";
import { resolveCadIngestIntelligence } from "./cad-ingest-intelligence.js";
import type { NormalizedCadIncident } from "./types.js";

const normalized = (over: Partial<NormalizedCadIncident> = {}): NormalizedCadIncident => ({
  cadNumber: "24-200",
  incidentType: "DV-IP",
  priority: "P2",
  location: "1 Main",
  units: ["P1"],
  rawPayload: {},
  ...over,
});

describe("resolveCadIngestIntelligence", () => {
  it("applies agency nature mapping to title, category, SOP, and supervisor alert", () => {
    const intel = resolveCadIngestIntelligence({
      normalized: normalized(),
      config: {
        natureCodeMappings: [
          {
            mappingId: "m1",
            cadNatureCode: "DVIP",
            cadNatureAliases: ["DV-IP"],
            rcIncidentTypeId: "domestic",
            rcIncidentTypeLabel: "Domestic Disturbance",
            rcIncidentCategory: "domestic_disturbance",
            protocolPackId: "default.domestic_silent_v1",
            supervisorAlert: true,
            sopOnIngest: true,
            enabled: true,
          },
        ],
      },
      existing: null,
      now: "2026-08-22T12:00:00.000Z",
      mappingEnabled: true,
    });
    expect(intel.title).toBe("Domestic Disturbance");
    expect(intel.category).toBe("domestic_disturbance");
    expect(intel.escalationFlag).toBe(true);
    expect(intel.sopOverlay?.recommendedProtocolPackId).toBe("default.domestic_silent_v1");
    expect(intel.sopOverlay?.source).toBe("cad_nature_code");
  });

  it("skips mapping when the feature flag is off", () => {
    const intel = resolveCadIngestIntelligence({
      normalized: normalized(),
      config: {
        natureCodeMappings: [
          {
            mappingId: "m1",
            cadNatureCode: "DV-IP",
            cadNatureAliases: [],
            protocolPackId: "default.domestic_silent_v1",
            supervisorAlert: true,
            sopOnIngest: true,
            enabled: true,
          },
        ],
      },
      existing: null,
      now: "2026-08-22T12:00:00.000Z",
      mappingEnabled: false,
    });
    expect(intel.title).toBe("DV-IP");
    expect(intel.sopOverlay).toBeNull();
    expect(intel.escalationFlag).toBeUndefined();
  });
});
