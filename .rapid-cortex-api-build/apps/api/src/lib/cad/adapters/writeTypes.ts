import type { CadWritebackBody } from "rapid-cortex-shared";
import type { Incident } from "rapid-cortex-shared";

export interface CadWriteAdapter {
  vendor: string;
  submit(params: {
    incident: Incident;
    payload: CadWritebackBody;
    config: Record<string, string>;
    cadIncidentId: string;
  }): Promise<{ success: boolean; cadResponse: string; errorMessage?: string }>;
}
