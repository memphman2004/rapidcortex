import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** CODY Computer Services CAD REST adapter. Auth: API key or basic. */
export class CodyAdapter extends RestCadAdapterBase {
  readonly vendorId = "cody" as const;

  incidentsPath(): string {
    return "/cody/api/v1/calls";
  }

  healthPath(): string {
    return "/cody/api/v1/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/cody/api/v1/calls/${encodeURIComponent(vendorIncidentId)}/comments`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        call_id: "CDY-901",
        call_type: "NOISE COMPLAINT",
        priority: 5,
        status: "pending",
        address: "12 Maple Ct",
        latitude: 36.16,
        longitude: -86.78,
        received_at: new Date().toISOString(),
      },
    ];
  }
}
