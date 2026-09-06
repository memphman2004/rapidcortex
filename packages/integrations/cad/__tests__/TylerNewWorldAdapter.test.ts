import { describe, expect, it } from "vitest";
import { TylerNewWorldAdapter } from "../adapters/TylerNewWorldAdapter.js";
import { xmlToRecord } from "../adapters/rest-http.js";
import type { CadConnectorConfig } from "rapid-cortex-shared";

const config: CadConnectorConfig = {
  connectorId: "cadc_t",
  agencyId: "test-agency",
  vendorId: "tyler_new_world",
  displayName: "Fire",
  department: "fire",
  enabled: true,
  connectionMode: "polling",
  credentials: { authType: "basic", secretArn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock" },
  fieldMappings: [],
  routingRules: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdByUserId: "t",
};

describe("TylerNewWorldAdapter", () => {
  it("normalizes REST payloads", () => {
    const adapter = new TylerNewWorldAdapter();
    const incident = adapter.normalize(adapter.sampleVendorPayloads()[0]!, config);
    expect(incident.vendorIncidentId).toBe("NW-7734");
    expect(incident.incidentType).toBe("STRUCTURE FIRE");
    expect(incident.status).toBe("en_route");
  });

  it("harvests SOAP XML into a record then normalizes", () => {
    const adapter = new TylerNewWorldAdapter();
    const xml = "<inc_nbr>NW-1</inc_nbr><call_type_cd>EMS</call_type_cd><priority_nbr>2</priority_nbr><inc_status_cd>ONSC</inc_status_cd><location_txt>1 Elm</location_txt>";
    const incident = adapter.normalize(xmlToRecord(xml), config);
    expect(incident.vendorIncidentId).toBe("NW-1");
    expect(incident.status).toBe("on_scene");
  });
});
