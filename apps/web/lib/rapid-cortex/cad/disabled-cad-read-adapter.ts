import type { CadEventRecord, CadIncidentRecord, CadUnitRecord } from "@/lib/rapid-cortex/cad/cad-models";
import type { CadReadProvider } from "@/lib/rapid-cortex/cad/cad-read-provider";
import type { CadHealthResult } from "@/lib/rapid-cortex/cad/CadAdapter";

/** Read facade when CAD is turned off globally — returns empty payloads without throwing read paths intended for dashboards. */
export class DisabledCadReadAdapter implements CadReadProvider {
  async healthCheck(): Promise<CadHealthResult> {
    return {
      ok: false,
      mode: "disabled",
      provider: "none",
      detail: "CAD integration disabled (`CAD_INTEGRATION_MODE`).",
    };
  }

  async listActiveIncidents(): Promise<CadIncidentRecord[]> {
    return [];
  }

  async getIncidentById(): Promise<CadIncidentRecord | null> {
    return null;
  }

  async listUnits(): Promise<CadUnitRecord[]> {
    return [];
  }

  async getUnitStatus(): Promise<CadUnitRecord | null> {
    return null;
  }

  async getRecentCadEvents(): Promise<CadEventRecord[]> {
    return [];
  }
}
