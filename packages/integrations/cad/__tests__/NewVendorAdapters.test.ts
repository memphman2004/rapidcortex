import { describe, expect, it } from "vitest";
import type { CadConnectorConfig, CadVendorId } from "rapid-cortex-shared";
import { CadAdapterRegistry } from "../adapters/CadAdapterRegistry.js";
import { RestCadAdapterBase } from "../adapters/RestCadAdapterBase.js";

const NEW_VENDORS: CadVendorId[] = [
  "mark43",
  "caliber",
  "versaterm",
  "rapiddeploy",
  "zetron",
  "eforce",
  "cody",
  "sunridge_rims",
  "kabat_one",
  "oracle_psdc",
];

function configFor(vendorId: CadVendorId): CadConnectorConfig {
  return {
    connectorId: `cadc_${vendorId}`,
    agencyId: "test-agency",
    vendorId,
    displayName: vendorId,
    department: "law_enforcement",
    enabled: true,
    connectionMode: "polling",
    credentials: {
      authType: "api_key",
      secretArn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock",
    },
    fieldMappings: [],
    routingRules: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdByUserId: "t",
  };
}

describe("new CAD vendor adapters", () => {
  it.each(NEW_VENDORS)("%s normalizes sample payloads with a vendor incident id", (vendorId) => {
    const adapter = CadAdapterRegistry.resolve(vendorId);
    expect(adapter).toBeInstanceOf(RestCadAdapterBase);
    const rest = adapter as RestCadAdapterBase;
    const samples = rest.sampleVendorPayloads();
    expect(samples.length).toBeGreaterThan(0);
    const incident = rest.normalize(samples[0]!, configFor(vendorId));
    expect(incident.vendorIncidentId.length).toBeGreaterThan(0);
    expect(incident.incidentType.length).toBeGreaterThan(0);
    expect(incident.agencyId).toBe("test-agency");
    expect(incident.vendorId).toBe(vendorId);
  });
});
