import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/**
 * Tyler Technologies New World CAD adapter.
 * REST in NW v10+; older SOAP XML is harvested into a flat record before normalize().
 */
export class TylerNewWorldAdapter extends RestCadAdapterBase {
  readonly vendorId = "tyler_new_world" as const;

  incidentsPath(): string {
    return "/api/cad/incidents";
  }

  healthPath(): string {
    return "/api/cad/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/api/cad/incidents/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        inc_nbr: "NW-7734",
        call_type_cd: "STRUCTURE FIRE",
        priority_nbr: 2,
        inc_status_cd: "ENRT",
        location_txt: "456 Oak Ave",
        lat_dec: 33.77,
        lon_dec: -84.39,
        received_dt: new Date(Date.now() - 2 * 60_000).toISOString(),
      },
    ];
  }
}
