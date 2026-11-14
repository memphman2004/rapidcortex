import type { CadAvlUnitPosition } from "rapid-cortex-shared";

const DEFAULT_STALE_AFTER_SECONDS = 120;

/**
 * Filter AVL positions to the caller's agency and drop stale rows.
 * Map overlays must never render another tenant's units.
 */
export function filterAvlUnitsForAgency(
  rows: CadAvlUnitPosition[],
  agencyId: string,
  opts?: { staleAfterSeconds?: number; nowMs?: number },
): CadAvlUnitPosition[] {
  const staleAfter = opts?.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS;
  const now = opts?.nowMs ?? Date.now();
  return rows.filter((row) => {
    if (row.agencyId !== agencyId) return false;
    const ts = Date.parse(row.timestamp);
    if (Number.isNaN(ts)) return false;
    return now - ts <= staleAfter * 1000;
  });
}

/**
 * Roles allowed to see AVL overlays (#62 RBAC).
 * Agency Admin is intentionally excluded even when holding cad.incidents.view.
 */
export function canViewCadAvl(role: string | undefined | null): boolean {
  const r = (role ?? "").toLowerCase();
  return r === "dispatcher" || r === "supervisor" || r === "rcsuperadmin";
}
