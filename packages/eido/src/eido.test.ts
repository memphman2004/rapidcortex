import { describe, expect, it } from "vitest";
import { buildEido, parseEido, validateEido } from "./index";

describe("@rc/eido", () => {
  it("builds a NENA-shaped transfer document from a hub incident", () => {
    const doc = buildEido({
      incidentId: "BKC-1001",
      agencyId: "berkeley-county-sc",
      agencyName: "Berkeley County Combined Dispatch",
      commonIncidentTypeCode: "STRFIRE",
      incidentTypeLabel: "Structure Fire",
      priority: 1,
      latitude: 33.012,
      longitude: -80.041,
      civicAddress: "412 County Line Rd",
      city: "Sangaree",
      state: "SC",
      occurredAt: "2026-09-18T15:04:00.000Z",
    });
    expect(doc.$id).toContain("BKC-1001");
    expect(doc.eidoVersion).toBe("1.0");
    expect(doc.incidentComponent?.[0]?.commonIncidentTypeCode).toBe("STRFIRE");
    expect(doc.locationComponent?.[0]?.latitude).toBe(33.012);
    expect(validateEido(doc)).toEqual([]);
    const parsed = parseEido(JSON.parse(JSON.stringify(doc)));
    expect(parsed.issuingElementIdentification).toBe("berkeley-county-sc");
  });

  it("parses a NENA sample-like envelope (required top-level fields only)", () => {
    const sample = {
      $id: "urn:emergency:uid:incidentid:a56e556d871:bcf.state.pa.us",
      lastUpdateTimeStamp: "2021-04-30T14:43:49.439-04:00",
      eidoVersion: "1.0",
      issuingElementIdentification: "idx.state.pa.us",
      callComponent: [{ $id: "urn:emergency:uid:callid:a56e556d871:bcf.state.pa.us", lastUpdateTimeStamp: "2021-04-30T14:42:00.0-04:00" }],
    };
    expect(validateEido(sample)).toEqual([]);
    expect(parseEido(sample).$id).toContain("incidentid");
  });

  it("rejects documents missing $id", () => {
    expect(validateEido({ eidoVersion: "1.0", lastUpdateTimeStamp: "2026-01-01T00:00:00Z", issuingElementIdentification: "x" }).length).toBeGreaterThan(0);
    expect(() => parseEido({})).toThrow(/Invalid EIDO/);
  });

  it("rejects a non-object payload", () => {
    expect(validateEido(null)[0]?.message).toMatch(/JSON object/);
    expect(validateEido("eido")[0]?.path).toBe("$");
  });
});
