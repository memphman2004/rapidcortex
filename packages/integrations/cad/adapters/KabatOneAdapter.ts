import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** KabatOne K-Dispatch CAD REST adapter. Auth: API key. */
export class KabatOneAdapter extends RestCadAdapterBase {
  readonly vendorId = "kabat_one" as const;

  incidentsPath(): string {
    return "/kdispatch/api/calls";
  }

  healthPath(): string {
    return "/kdispatch/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/kdispatch/api/calls/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        dispatchId: "K1-3308",
        callNature: "ALARM",
        priority: 2,
        status: "dispatched",
        address: "55 Commerce Dr",
        latitude: 29.76,
        longitude: -95.37,
        receivedAt: new Date().toISOString(),
      },
    ];
  }
}
