import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Mark43 CAD REST adapter. Auth: API key or OAuth2. Paths configurable per agency baseUrl. */
export class Mark43Adapter extends RestCadAdapterBase {
  readonly vendorId = "mark43" as const;

  incidentsPath(): string {
    return "/api/v1/incidents";
  }

  healthPath(): string {
    return "/api/v1/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/v1/incidents/${encodeURIComponent(vendorIncidentId)}/notes`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        id: "M43-2201",
        type: "BURGLARY",
        priority: 2,
        status: "dispatched",
        address: "450 Market St",
        latitude: 37.79,
        longitude: -122.4,
        receivedAt: new Date().toISOString(),
      },
    ];
  }
}
