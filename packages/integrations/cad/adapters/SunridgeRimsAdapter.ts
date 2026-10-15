import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Sunridge Systems RIMS CAD REST adapter. Auth: API key. */
export class SunridgeRimsAdapter extends RestCadAdapterBase {
  readonly vendorId = "sunridge_rims" as const;

  incidentsPath(): string {
    return "/rims/api/incidents";
  }

  healthPath(): string {
    return "/rims/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/rims/api/incidents/${encodeURIComponent(vendorIncidentId)}/narrative`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        caseNumber: "RIMS-7721",
        natureCode: "WELFARE",
        priority: 3,
        statusCode: "ENRT",
        streetAddress: "401 Civic Center",
        lat: 34.05,
        lon: -118.24,
        createDateTime: new Date().toISOString(),
      },
    ];
  }
}
