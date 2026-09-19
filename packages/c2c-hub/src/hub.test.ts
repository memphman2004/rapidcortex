import { describe, expect, it } from "vitest";
import { berkeleyMockAdapter } from "./adapters/mock";
import { CentralSquareC2cAdapter, SouthernSoftwareAdapter } from "./adapters/vendors";
import { runBerkeleyToCharlestonDemo } from "./demo";
import { C2cHub } from "./hub";
import { BERKELEY_COUNTY, CHARLESTON_COUNTY, SEED_TRANSFER_RULES } from "./seed";

describe("C2C mock hub demo (Berkeley → Charleston)", () => {
  it("processes simulated Berkeley incidents onto Charleston as EIDO", () => {
    const result = runBerkeleyToCharlestonDemo();
    expect(result.ingested.map((i) => i.incidentId)).toEqual([
      "BKC-1001",
      "BKC-1002",
      "BKC-1003",
      "BKC-1004",
      "BKC-1005",
    ]);
    expect(result.skipped.map((s) => s.incidentId)).toEqual(["BKC-1005"]);
    const types = result.charlestonInbox.map((t) => t.eido.incidentComponent?.[0]?.commonIncidentTypeCode);
    expect(types).toEqual(["STRFIRE", "MVAINJ", "PURSUIT", "CARDIAC"]);
    for (const transfer of result.charlestonInbox) {
      expect(transfer.eido.eidoVersion).toBe("1.0");
      expect(transfer.eido.$id).toContain("urn:emergency:uid:incidentid:");
      expect(transfer.toAgencyId).toBe("charleston-county-sc");
      expect(transfer.eido.issuingElementIdentification).toBe("berkeley-county-sc");
    }
  });
});

describe("vendor adapter stubs", () => {
  it("maps Southern Software CAD fields", () => {
    const ss = new SouthernSoftwareAdapter("berkeley-county-sc");
    const incident = ss.mapVendorIncident({
      CallNumber: "SS-88",
      CallType: "STRUCTURE FIRE",
      Priority: 1,
      Address: "1 Main",
      City: "Moncks Corner",
      Latitude: 33.01,
      Longitude: -80.04,
      CreateTime: "2026-09-18T15:00:00.000Z",
    });
    expect(incident.commonIncidentTypeCode).toBe("STRFIRE");
    expect(incident.incidentNumber).toBe("SS-88");
  });

  it("maps CentralSquare CAD fields", () => {
    const cs = new CentralSquareC2cAdapter("charleston-county-sc");
    const incident = cs.mapVendorIncident({
      call_number: "CS-4410",
      call_type: "TRAFFIC STOP",
      priority: 4,
      location: { address: "12 Peachtree St", lat: 33.755, lng: -84.39 },
      received_at: "2026-09-18T15:00:00.000Z",
    });
    expect(incident.commonIncidentTypeCode).toBe("TRAFSTP");
    expect(incident.incidentId).toBe("CS-4410");
  });
});

describe("C2cHub destination registration", () => {
  it("skips when the destination adapter is not registered", () => {
    const berkeley = berkeleyMockAdapter();
    const hub = new C2cHub(
      [BERKELEY_COUNTY, CHARLESTON_COUNTY],
      SEED_TRANSFER_RULES,
      new Map([[BERKELEY_COUNTY.agencyId, berkeley]]),
    );
    const result = hub.runProducer(BERKELEY_COUNTY.agencyId);
    expect(result.transfers).toEqual([]);
    expect(result.skipped.some((row) => row.reason === "destination adapter not registered")).toBe(true);
    expect(result.skipped.some((row) => row.incidentId === "BKC-1005" && row.reason === "no matching transfer rule")).toBe(true);
  });
});
