import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/** Hexagon (Intergraph) I/CAD adapter — REST with SOAP fallback harvest. */
export class HexagonIntergraphAdapter extends RestCadAdapterBase {
  readonly vendorId = "hexagon_intergraph" as const;

  incidentsPath(): string {
    return "/icad/api/calls";
  }

  healthPath(): string {
    return "/icad/api/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/icad/api/calls/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        CallId: "HX-2201",
        CallCode: "MEDICAL EMERGENCY",
        CallPriority: 2,
        CallStatus: "SCENE",
        EntryAddress: "789 Elm Blvd",
        Latitude: 33.76,
        Longitude: -84.4,
        CreateDate: new Date(Date.now() - 6 * 60_000).toISOString(),
      },
    ];
  }
}
