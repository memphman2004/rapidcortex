import { describe, expect, it } from "vitest";
import { CadDeduplicationEngine } from "../services/CadDeduplicationEngine.js";
import type { UnifiedCadIncident } from "rapid-cortex-shared";

function incident(over: Partial<UnifiedCadIncident> = {}): UnifiedCadIncident {
  return {
    unifiedId: "ucad_1",
    agencyId: "test-agency",
    connectorId: "cadc_a",
    vendorId: "motorola_premierone",
    department: "law_enforcement",
    vendorIncidentId: "P1-1",
    incidentType: "ROBBERY",
    priority: 1,
    status: "dispatched",
    address: "123 Main St.",
    units: [],
    callReceivedAt: "2026-09-05T22:00:30.000Z",
    dedupeKey: "",
    isDuplicate: false,
    ingestedAt: "2026-09-05T22:01:00.000Z",
    lastSyncAt: "2026-09-05T22:01:00.000Z",
    schemaVersion: 1,
    ...over,
  };
}

describe("CadDeduplicationEngine", () => {
  it("skips exact duplicates on same connector + vendor id", () => {
    const a = incident();
    const result = CadDeduplicationEngine.evaluateInMemory(a, [a]);
    expect(result.action).toBe("skip_exact_duplicate");
  });

  it("marks cross-connector duplicates sharing the same dedupe key", () => {
    const a = incident({ dedupeKey: CadDeduplicationEngine.buildDedupeKey(incident()) });
    const b = incident({
      unifiedId: "ucad_2",
      connectorId: "cadc_b",
      vendorIncidentId: "NW-9",
      vendorId: "tyler_new_world",
      address: "123 Main St",
    });
    const result = CadDeduplicationEngine.evaluateInMemory(b, [a]);
    expect(result.action).toBe("mark_cross_connector_duplicate");
  });

  it("inserts unique incidents", () => {
    const a = incident();
    const b = incident({
      unifiedId: "ucad_3",
      vendorIncidentId: "P1-99",
      address: "999 Other Rd",
      incidentType: "FIRE",
    });
    const result = CadDeduplicationEngine.evaluateInMemory(b, [a]);
    expect(result.action).toBe("insert");
  });
});
