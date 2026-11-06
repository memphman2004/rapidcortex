import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/**
 * Southern Software (VisiCAD) Multi-CAD Connector.
 *
 * Paths follow the assumed partner API in docs/c2c/SOUTHERN_SOFTWARE_API_SPEC.md
 * (`/ssapi/v1/...`). Confirm with Southern Software before production cutover;
 * agency field mappings can override defaults when payloads differ.
 *
 * Auth (live): ApiKey via Secrets Manager. Mock mode uses sampleVendorPayloads().
 * Write-back stays fail-closed until CAD write-back is explicitly enabled.
 */
export class SouthernSoftwareAdapter extends RestCadAdapterBase {
  readonly vendorId = "southern_software" as const;

  incidentsPath(): string {
    return "/ssapi/v1/incidents";
  }

  healthPath(): string {
    return "/ssapi/v1/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/ssapi/v1/incidents/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        incidentId: "2026-SS-001234",
        callType: "MVA",
        priority: "1",
        status: "DISPATCHED",
        address: "1234 Main St",
        city: "Moncks Corner",
        county: "Berkeley",
        latitude: 33.195,
        longitude: -80.012,
        callerName: "Jane Caller",
        callerPhone: "+18435550142",
        units: [{ unitId: "M1", unitType: "MEDIC", status: "ER" }],
        narrative: [{ sequence: 1, text: "Two-vehicle collision, lane blocked", operator: "D01", timestamp: new Date().toISOString() }],
        receivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}
