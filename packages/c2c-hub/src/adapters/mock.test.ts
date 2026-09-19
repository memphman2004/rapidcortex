import { describe, expect, it } from "vitest";
import { buildEido } from "@rc/eido";
import { berkeleyDemoIncidents } from "../seed";
import { berkeleyMockAdapter, charlestonMockAdapter, MockCadAdapter } from "./mock";

describe("MockCadAdapter (demo engine)", () => {
  it("Berkeley producer emits the five seed incidents", () => {
    const berkeley = berkeleyMockAdapter();
    expect(berkeley.vendorId).toBe("mock");
    expect(berkeley.ingest().map((row) => row.incidentId)).toEqual([
      "BKC-1001",
      "BKC-1002",
      "BKC-1003",
      "BKC-1004",
      "BKC-1005",
    ]);
    expect(berkeley.ingest()[0]).not.toBe(berkeleyDemoIncidents()[0]);
  });

  it("Charleston sink stores delivered EIDO transfers", () => {
    const charleston = charlestonMockAdapter();
    expect(charleston.receivedTransfers()).toEqual([]);
    const incident = berkeleyDemoIncidents()[0]!;
    const eido = buildEido({
      incidentId: incident.incidentId,
      incidentNumber: incident.incidentNumber,
      agencyId: incident.sourceAgencyId,
      agencyName: "Berkeley County Combined Dispatch",
      commonIncidentTypeCode: incident.commonIncidentTypeCode,
      incidentTypeLabel: incident.incidentTypeLabel,
      priority: incident.priority,
      latitude: incident.latitude,
      longitude: incident.longitude,
      civicAddress: incident.civicAddress,
      city: incident.city,
      state: incident.state,
      occurredAt: incident.occurredAt,
    });
    charleston.deliver(eido, { transferId: "t1", ruleId: "rule-fire-auto-aid" });
    const inbox = charleston.receivedTransfers();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.eido.incidentComponent?.[0]?.commonIncidentTypeCode).toBe("STRFIRE");
    expect(inbox[0]?.fromAgencyId).toBe("berkeley-county-sc");
    expect(inbox[0]?.toAgencyId).toBe("charleston-county-sc");
    inbox.pop();
    expect(charleston.receivedTransfers()).toHaveLength(1);
  });

  it("empty producer returns no incidents", () => {
    const idle = new MockCadAdapter("idle-agency");
    expect(idle.ingest()).toEqual([]);
  });
});
