import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** RapidDeploy Cloud Aided Dispatch REST adapter. Auth: API key or OAuth2. */
export class RapidDeployAdapter extends RestCadAdapterBase {
  readonly vendorId = "rapiddeploy" as const;

  incidentsPath(): string {
    return "/v1/incidents";
  }

  healthPath(): string {
    return "/v1/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/v1/incidents/${encodeURIComponent(vendorIncidentId)}/updates`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        incidentId: "RD-5010",
        nature: "FIRE ALARM",
        priority: 1,
        status: "dispatched",
        address: "15 Harbor Blvd",
        lat: 32.72,
        lng: -117.16,
        createdAt: new Date().toISOString(),
      },
    ];
  }
}
