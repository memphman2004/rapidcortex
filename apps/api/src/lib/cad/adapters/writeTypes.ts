import type { CadWritebackBody } from "rapid-cortex-shared";
import type { Incident } from "rapid-cortex-shared";

export type CadAdapterHealth = {
  ok: boolean;
  detail: string;
  latencyMs?: number;
};

export type CadAdapterReadResult = {
  ok: boolean;
  incident?: Record<string, unknown>;
  errorMessage?: string;
};

export interface CadWriteAdapter {
  vendor: string;
  submit(params: {
    incident: Incident;
    payload: CadWritebackBody;
    config: Record<string, string>;
    cadIncidentId: string;
  }): Promise<{ success: boolean; cadResponse: string; errorMessage?: string }>;
  /** Vendor read — used by poll/health surfaces. Must be implemented (may return not-implemented). */
  read(params: {
    config: Record<string, string>;
    cadIncidentId: string;
  }): Promise<CadAdapterReadResult>;
  /** Vendor connectivity probe. Must be implemented (may return not-implemented). */
  healthCheck(params: { config: Record<string, string> }): Promise<CadAdapterHealth>;
}

export class UnknownCadVendorError extends Error {
  readonly vendor: string;
  constructor(vendor: string) {
    super(`Unknown CAD vendor configuration: ${vendor}`);
    this.name = "UnknownCadVendorError";
    this.vendor = vendor;
  }
}
