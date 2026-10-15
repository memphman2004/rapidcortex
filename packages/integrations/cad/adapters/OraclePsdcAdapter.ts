import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Oracle Public Safety Dispatch Command Center REST adapter. Auth: OAuth2. */
export class OraclePsdcAdapter extends RestCadAdapterBase {
  readonly vendorId = "oracle_psdc" as const;

  incidentsPath(): string {
    return "/psdc/api/v1/incidents";
  }

  healthPath(): string {
    return "/psdc/api/v1/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/psdc/api/v1/incidents/${encodeURIComponent(vendorIncidentId)}/updates`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        IncidentId: "ORC-6100",
        IncidentType: "HAZMAT",
        Priority: 1,
        IncidentStatus: "DISPATCHED",
        LocationAddress: "1 Port Way",
        Latitude: 47.61,
        Longitude: -122.33,
        ReceivedTime: new Date().toISOString(),
      },
    ];
  }
}
