import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Spillman Flex CAD REST adapter. Auth: API key. */
export class SpillmanAdapter extends RestCadAdapterBase {
  readonly vendorId = "spillman" as const;

  incidentsPath(): string {
    return "/flex/api/calls";
  }

  healthPath(): string {
    return "/flex/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/flex/api/calls/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        callId: "SP-9001",
        callType: "WELFARE CHECK",
        priority: 3,
        callStatus: "DISP",
        address: "100 Pine Rd",
        gpsLat: 33.74,
        gpsLon: -84.37,
        receivedAt: new Date().toISOString(),
      },
    ];
  }
}
