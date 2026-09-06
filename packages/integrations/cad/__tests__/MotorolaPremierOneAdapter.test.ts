import { describe, expect, it } from "vitest";
import { MotorolaPremierOneAdapter } from "../adapters/MotorolaPremierOneAdapter.js";
import type { CadConnectorConfig } from "rapid-cortex-shared";

const config: CadConnectorConfig = {
  connectorId: "cadc_m",
  agencyId: "test-agency",
  vendorId: "motorola_premierone",
  displayName: "Law",
  department: "law_enforcement",
  enabled: true,
  connectionMode: "polling",
  credentials: { authType: "api_key", secretArn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock" },
  fieldMappings: [],
  routingRules: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdByUserId: "t",
};

describe("MotorolaPremierOneAdapter", () => {
  it("normalizes PremierOne sample payloads", () => {
    const adapter = new MotorolaPremierOneAdapter();
    const raw = adapter.sampleVendorPayloads()[0]!;
    const incident = adapter.normalize(raw, config);
    expect(incident.vendorIncidentId).toBe("P1-1001");
    expect(incident.incidentType).toBe("ARMED ROBBERY");
    expect(incident.address).toBe("123 Main St");
    expect(incident.status).toBe("on_scene");
    expect(incident.rawVendorPayload).toBeDefined();
  });
});
