/**
 * Pilot safety gate: CAD write-back is opt-in ONLY when `CAD_WRITEBACK_ENABLED` is explicitly `"true"`.
 * Undefined/empty/other values behave as blocked (fail-closed).
 *
 * TODO(prod) — Section 4.1: add server-side gates for env vars below in production ECS/Lambda parity if not mirrored:
 *   `CAD_WRITEBACK_REQUIRES_SUPERVISOR_APPROVAL=true`
 *   `CAD_WRITEBACK_MANUAL_MODE_DEFAULT=true`
 */
export function getCadWritebackRaw(): string | undefined {
  const v = process.env.CAD_WRITEBACK_ENABLED;
  return v === undefined ? undefined : v.trim();
}

export function isCadWriteBackExplicitlyEnabled(): boolean {
  return getCadWritebackRaw() === "true";
}
