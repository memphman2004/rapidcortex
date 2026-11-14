import type { CadAdapterHealth, CadAdapterReadResult } from "./writeTypes.js";

/** Shared no-op probes for vendors without a dedicated read/health endpoint yet. */
export async function unsupportedHealthCheck(vendor: string): Promise<CadAdapterHealth> {
  return { ok: false, detail: `${vendor}: healthCheck not implemented for this vendor` };
}

export async function unsupportedRead(
  vendor: string,
): Promise<CadAdapterReadResult> {
  return { ok: false, errorMessage: `${vendor}: read not implemented for this vendor` };
}
