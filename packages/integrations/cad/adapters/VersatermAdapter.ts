import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Versaterm CAD / Public Safety Suite REST adapter. Auth: API key or OAuth2. */
export class VersatermAdapter extends RestCadAdapterBase {
  readonly vendorId = "versaterm" as const;

  incidentsPath(): string {
    return "/api/v1/events";
  }

  healthPath(): string {
    return "/api/v1/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/v1/events/${encodeURIComponent(vendorIncidentId)}/comments`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        eventId: "VT-8801",
        eventType: "TRAFFIC COLLISION",
        priority: 3,
        status: "ONSCENE",
        fullAddress: "200 King St W",
        latitude: 43.65,
        longitude: -79.38,
        createTime: new Date().toISOString(),
      },
    ];
  }
}
