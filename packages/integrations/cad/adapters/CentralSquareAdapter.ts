import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** CentralSquare CAD Pro / OnDemand REST adapter. Auth: OAuth2 client credentials. */
export class CentralSquareAdapter extends RestCadAdapterBase {
  readonly vendorId = "central_square" as const;

  incidentsPath(): string {
    return "/api/calls";
  }

  healthPath(): string {
    return "/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/calls/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        call_number: "CS-4410",
        call_type: "TRAFFIC STOP",
        priority: 4,
        call_status: "dispatched",
        location: { address: "12 Peachtree St", lat: 33.755, lng: -84.39 },
        received_at: new Date().toISOString(),
      },
    ];
  }
}
