import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/**
 * Motorola PremierOne CAD adapter.
 *
 * PremierOne REST (API Server v3+): GET /api/v1/incidents with LastUpdateTime.
 * Auth: X-API-Key or OAuth2. Timestamps are agency-local — date_iso transform is required.
 */
export class MotorolaPremierOneAdapter extends RestCadAdapterBase {
  readonly vendorId = "motorola_premierone" as const;

  incidentsPath(): string {
    return "/api/v1/incidents";
  }

  healthPath(): string {
    return "/api/v1/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/v1/incidents/${encodeURIComponent(vendorIncidentId)}/updates`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        EventNumber: "P1-1001",
        CallType: "ARMED ROBBERY",
        Priority: 1,
        IncidentStatus: "ONSCENE",
        Location: { FullAddress: "123 Main St", Latitude: 33.749, Longitude: -84.388 },
        CallerName: "Jane Caller",
        CallerPhone: "4045550100",
        ReceivedTime: new Date(Date.now() - 4 * 60_000).toISOString(),
        DispatchedTime: new Date(Date.now() - 3 * 60_000).toISOString(),
        Units: [{ UnitId: "E12", CallSign: "E12", Status: "on_scene" }],
      },
    ];
  }
}
