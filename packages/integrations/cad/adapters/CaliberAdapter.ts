import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Caliber Public Safety CAD REST adapter. Auth: API key. */
export class CaliberAdapter extends RestCadAdapterBase {
  readonly vendorId = "caliber" as const;

  incidentsPath(): string {
    return "/api/cad/calls";
  }

  healthPath(): string {
    return "/api/cad/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/cad/calls/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        callNumber: "CAL-3102",
        callType: "DOMESTIC",
        priority: 2,
        status: "enroute",
        location: "88 Oak Ave",
        lat: 35.22,
        lon: -80.84,
        receivedAt: new Date().toISOString(),
      },
    ];
  }
}
