import { AdapterError } from "./adapter.interface.js";

/** Live partner CAD HTTP writes stay fail-closed unless CAD_WRITEBACK_ENABLED is true/1. */
export function isCadWritebackEnabled(): boolean {
  const v = process.env.CAD_WRITEBACK_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1";
}

export function assertCadWritebackEnabled(agencyId: string, method: string): void {
  if (isCadWritebackEnabled()) return;
  throw new AdapterError(
    `[${agencyId}] ${method}() blocked — CAD write-back is fail-closed. Set CAD_WRITEBACK_ENABLED=true only after the CAD write-back addendum and go/no-go.`,
    agencyId,
    method,
  );
}
