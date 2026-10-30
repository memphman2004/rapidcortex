import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/**
 * ProPhoenix CAD connector.
 * The agency base URL is the Phoenix interface they license. ProPhoenix does not
 * publish these paths. Field mappings on the connector replace the defaults when
 * their Calls for Service payload uses different names.
 * Write-back stays fail-closed until CAD write-back is explicitly enabled.
 */
export class ProPhoenixAdapter extends RestCadAdapterBase {
  readonly vendorId = "prophoenix" as const;

  incidentsPath(): string {
    return "/api/calls-for-service";
  }

  healthPath(): string {
    return "/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/calls-for-service/${encodeURIComponent(vendorIncidentId)}/narrative`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        CfsNumber: "CFS-2026-10442",
        Nature: "WELFARE CHECK",
        Priority: 3,
        CallStatus: "DISPATCHED",
        Address: "4200 Main St",
        Latitude: 39.0997,
        Longitude: -94.5786,
        ReceivedDateTime: new Date().toISOString(),
        CallerName: "Jane Caller",
        CallerPhone: "8165550142",
      },
    ];
  }
}
