import { RestCadAdapterBase } from "./RestCadAdapterBase.js";

/**
 * Generic REST adapter — agencies must supply CadFieldMapping[].
 * Auth: api_key or basic only (enforced at connector create time).
 */
export class GenericRestAdapter extends RestCadAdapterBase {
  readonly vendorId = "generic_rest" as const;

  incidentsPath(): string {
    return "/incidents";
  }

  healthPath(): string {
    return "/health";
  }

  writeBackPath(vendorIncidentId: string): string {
    return `/incidents/${encodeURIComponent(vendorIncidentId)}`;
  }

  override sampleVendorPayloads(): Record<string, unknown>[] {
    return [
      {
        id: "GEN-1",
        type: "ASSIST",
        priority: 5,
        status: "pending",
        address: "1 Generic Way",
      },
    ];
  }
}
