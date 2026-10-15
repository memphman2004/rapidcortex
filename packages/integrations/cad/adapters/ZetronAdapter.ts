import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Zetron / Intertalk CAD suite REST adapter. Auth: API key or basic. */
export class ZetronAdapter extends RestCadAdapterBase {
  readonly vendorId = "zetron" as const;

  incidentsPath(): string {
    return "/api/calls";
  }

  healthPath(): string {
    return "/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/calls/${encodeURIComponent(vendorIncidentId)}/notes`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        callId: "ZT-1204",
        callType: "MEDICAL",
        priority: 2,
        callStatus: "DISP",
        address: "900 Industrial Pkwy",
        gpsLat: 39.1,
        gpsLon: -94.58,
        receivedAt: new Date().toISOString(),
      },
    ];
  }
}
