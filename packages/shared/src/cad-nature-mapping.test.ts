import { describe, expect, it } from "vitest";
import {
  buildCadMappedSopOverlay,
  canonicalizeCadNatureMappings,
  matchCadNatureMapping,
  normalizeCadNatureCode,
  parseCadNatureCodeMappings,
  type CadNatureCodeMapping,
} from "./cad-nature-mapping.js";

function mapping(partial: Partial<CadNatureCodeMapping> & Pick<CadNatureCodeMapping, "mappingId" | "cadNatureCode">): CadNatureCodeMapping {
  return {
    cadNatureAliases: [],
    supervisorAlert: false,
    sopOnIngest: true,
    enabled: true,
    ...partial,
  };
}

describe("normalizeCadNatureCode", () => {
  it("folds separators and case so agency codes match vendor variants", () => {
    expect(normalizeCadNatureCode("DV-IP")).toBe("DVIP");
    expect(normalizeCadNatureCode("dv_ip")).toBe("DVIP");
    expect(normalizeCadNatureCode(" 10-16 ")).toBe("1016");
    expect(normalizeCadNatureCode("FIRE/STRUCT")).toBe("FIRESTRUCT");
  });
});

describe("matchCadNatureMapping", () => {
  const rows = [
    mapping({
      mappingId: "m1",
      cadNatureCode: "DV-IP",
      cadNatureAliases: ["10-16", "DOM"],
      protocolPackId: "default.domestic_silent_v1",
      rcIncidentCategory: "domestic_disturbance",
    }),
    mapping({
      mappingId: "m2",
      cadNatureCode: "SHOTS",
      enabled: false,
      protocolPackId: "default.unknown_stress_v1",
    }),
  ];

  it("matches exact, hyphen, and alias forms", () => {
    expect(matchCadNatureMapping(rows, "dv-ip")?.mappingId).toBe("m1");
    expect(matchCadNatureMapping(rows, "DVIP")?.mappingId).toBe("m1");
    expect(matchCadNatureMapping(rows, "10-16")?.mappingId).toBe("m1");
    expect(matchCadNatureMapping(rows, "dom")?.mappingId).toBe("m1");
  });

  it("skips disabled mappings", () => {
    expect(matchCadNatureMapping(rows, "SHOTS")).toBeNull();
  });

  it("returns empty from invalid config without throwing", () => {
    expect(parseCadNatureCodeMappings({ natureCodeMappings: "nope" })).toEqual([]);
    expect(parseCadNatureCodeMappings(undefined)).toEqual([]);
  });
});

describe("canonicalizeCadNatureMappings", () => {
  it("rejects duplicate enabled codes after normalization", () => {
    const result = canonicalizeCadNatureMappings(
      [
        mapping({ mappingId: "a", cadNatureCode: "DV-IP" }),
        mapping({ mappingId: "b", cadNatureCode: "dv_ip" }),
      ],
      () => "new",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unknown protocol packs", () => {
    const result = canonicalizeCadNatureMappings(
      [mapping({ mappingId: "a", cadNatureCode: "X", protocolPackId: "not.a.pack" })],
      () => "new",
    );
    expect(result.ok).toBe(false);
  });

  it("accepts a known protocol pack", () => {
    const result = canonicalizeCadNatureMappings(
      [
        mapping({
          mappingId: "a",
          cadNatureCode: "FIRE",
          protocolPackId: "default.fire_evac_v1",
        }),
      ],
      () => "new",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mappings[0]?.protocolPackId).toBe("default.fire_evac_v1");
  });
});

describe("buildCadMappedSopOverlay", () => {
  const hit = mapping({
    mappingId: "m1",
    cadNatureCode: "DOM",
    protocolPackId: "default.domestic_silent_v1",
    rcIncidentTypeLabel: "Domestic Disturbance",
  });

  it("applies agency mapping at high confidence", () => {
    const overlay = buildCadMappedSopOverlay({ mapping: hit, existing: null, now: "2026-08-22T12:00:00.000Z" });
    expect(overlay?.recommendedProtocolPackId).toBe("default.domestic_silent_v1");
    expect(overlay?.source).toBe("cad_nature_code");
    expect(overlay?.confidence).toBeGreaterThan(0.9);
    expect(overlay?.incidentTypeLabel).toBe("Domestic Disturbance");
  });

  it("does not fight dispatcher dismiss or manual override", () => {
    expect(
      buildCadMappedSopOverlay({
        mapping: hit,
        existing: {
          recommendedProtocolPackId: "default.welfare_check_v1",
          incidentTypeLabel: "x",
          confidence: 0.4,
          dismissedAt: "2026-08-22T11:00:00.000Z",
          manualProtocolPackId: null,
          completedStepIds: [],
          segmentCountAtDetection: 0,
          detectedAt: "2026-08-22T10:00:00.000Z",
        },
        now: "2026-08-22T12:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      buildCadMappedSopOverlay({
        mapping: hit,
        existing: {
          recommendedProtocolPackId: null,
          incidentTypeLabel: "x",
          confidence: 0.4,
          dismissedAt: null,
          manualProtocolPackId: "default.cpr_cardiac_v1",
          completedStepIds: [],
          segmentCountAtDetection: 0,
          detectedAt: "2026-08-22T10:00:00.000Z",
        },
        now: "2026-08-22T12:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("does not overwrite a high-confidence transcript detection", () => {
    expect(
      buildCadMappedSopOverlay({
        mapping: hit,
        existing: {
          recommendedProtocolPackId: "default.cpr_cardiac_v1",
          incidentTypeLabel: "CPR",
          confidence: 0.88,
          dismissedAt: null,
          manualProtocolPackId: null,
          completedStepIds: [],
          segmentCountAtDetection: 12,
          detectedAt: "2026-08-22T11:00:00.000Z",
          source: "transcript",
        },
        now: "2026-08-22T12:00:00.000Z",
      }),
    ).toBeNull();
  });
});
