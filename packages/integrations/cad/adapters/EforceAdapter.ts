import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** EFORCE Software CAD REST adapter. Auth: API key. */
export class EforceAdapter extends RestCadAdapterBase {
  readonly vendorId = "eforce" as const;

  incidentsPath(): string {
    return "/eforce/api/incidents";
  }

  healthPath(): string {
    return "/eforce/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/eforce/api/incidents/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        incidentNumber: "EF-4402",
        incidentType: "SUSPICIOUS PERSON",
        priority: 4,
        status: "queued",
        locationText: "77 River Rd",
        latitude: 41.88,
        longitude: -87.63,
        receivedDateTime: new Date().toISOString(),
      },
    ];
  }
}
