import { describe, expect, it } from "vitest";
import { CadFieldMappingEngine } from "../services/CadFieldMappingEngine.js";
import type { CadFieldMapping } from "rapid-cortex-shared";

describe("CadFieldMappingEngine", () => {
  it("applies each transform type and nested paths", () => {
    const mappings: CadFieldMapping[] = [
      { mappingId: "1", vendorField: "CallType", rcField: "incidentType", required: true, direction: "inbound", transform: { type: "uppercase" } },
      { mappingId: "2", vendorField: "Location.FullAddress", rcField: "address", required: false, direction: "inbound", transform: { type: "trim" } },
      { mappingId: "3", vendorField: "Priority", rcField: "priority", required: false, direction: "inbound" },
      { mappingId: "4", vendorField: "x", rcField: "nature", required: false, direction: "inbound", transform: { type: "static_value", value: "FIXED" } },
      { mappingId: "5", vendorField: "code", rcField: "status", required: false, direction: "inbound", transform: { type: "code_lookup", table: { A: "dispatched" } } },
      { mappingId: "6", vendorField: "tag", rcField: "zone", required: false, direction: "inbound", transform: { type: "regex_extract", pattern: "Z-(\\d+)", group: 1 } },
    ];
    const { result, errors } = CadFieldMappingEngine.applyInbound(
      {
        CallType: " robbery ",
        Location: { FullAddress: "  123 Main  " },
        Priority: 1,
        code: "A",
        tag: "Z-12",
      },
      mappings,
    );
    expect(errors).toEqual([]);
    expect(result.incidentType).toBe(" ROBBERY ");
    expect(result.address).toBe("123 Main");
    expect(result.priority).toBe(1);
    expect(result.nature).toBe("FIXED");
    expect(result.status).toBe("dispatched");
    expect(result.zone).toBe("12");
  });

  it("collects missing required fields without throwing", () => {
    const mappings: CadFieldMapping[] = [
      { mappingId: "1", vendorField: "EventNumber", rcField: "vendorIncidentId", required: true, direction: "inbound" },
    ];
    const { errors } = CadFieldMappingEngine.applyInbound({}, mappings);
    expect(errors[0]?.field).toBe("EventNumber");
  });

  it("applies lowercase and date_iso transforms", () => {
    const mappings: CadFieldMapping[] = [
      {
        mappingId: "7",
        vendorField: "CallType",
        rcField: "incidentType",
        required: false,
        direction: "inbound",
        transform: { type: "lowercase" },
      },
      {
        mappingId: "8",
        vendorField: "ReceivedTime",
        rcField: "callReceivedAt",
        required: false,
        direction: "inbound",
        transform: { type: "date_iso", sourceFormat: "iso" },
      },
    ];
    const { result } = CadFieldMappingEngine.applyInbound(
      { CallType: "ROBBERY", ReceivedTime: "2026-09-05T22:00:00.000Z" },
      mappings,
    );
    expect(result.incidentType).toBe("robbery");
    expect(result.callReceivedAt).toBe("2026-09-05T22:00:00.000Z");
  });

  it("drops unknown vendor fields", () => {
    const { result } = CadFieldMappingEngine.applyInbound(
      { EventNumber: "1", Extra: "nope" },
      [{ mappingId: "1", vendorField: "EventNumber", rcField: "vendorIncidentId", required: true, direction: "inbound" }],
    );
    expect(result.vendorIncidentId).toBe("1");
    expect("Extra" in result).toBe(false);
  });
});
