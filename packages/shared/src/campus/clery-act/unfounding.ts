import type { CampusSecurityAuthority } from "./schemas.js";

/**
 * Unfounding is a sworn-officer determination, not an RBAC grant.
 * Role permission `clery.record.unfound` is necessary but never sufficient.
 */
export function canUnfoundCrime(csa: CampusSecurityAuthority | null | undefined, at = new Date()): boolean {
  if (!csa) return false;
  if (csa.reporterType !== "SWORN_OFFICER") return false;
  if (csa.isSwornOfficer !== true) return false;
  const badge = csa.badgeNumber?.trim() ?? "";
  if (!badge) return false;
  const from = Date.parse(csa.activeFrom);
  if (Number.isNaN(from) || at.getTime() < from) return false;
  if (csa.activeTo) {
    const to = Date.parse(csa.activeTo);
    if (!Number.isNaN(to) && at.getTime() > to) return false;
  }
  return true;
}
