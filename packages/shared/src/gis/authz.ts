import { isRcInternalOperator } from "../tenancy/principal.js";
import { migrateLegacyRapidCortexRoleTokenValue } from "../auth/rapid-cortex-roles.js";

function roleToken(role: string | undefined | null): string {
  const raw = String(role ?? "").trim();
  return migrateLegacyRapidCortexRoleTokenValue(raw) ?? raw.toLowerCase();
}

/** Discover / import / approve / disconnect — agency admins + RC operators. */
export function canManageGisDatasets(role: string | undefined | null): boolean {
  const r = roleToken(role);
  if (isRcInternalOperator(r)) return true;
  return r === "agencyadmin" || r === "agencyit" || r === "campus_admin" || r === "venue_admin";
}

/** Read approved layers + spatial-context on the operational map. */
export function canViewGisLayers(role: string | undefined | null): boolean {
  if (canManageGisDatasets(role)) return true;
  const r = roleToken(role);
  return (
    r === "dispatcher" ||
    r === "supervisor" ||
    r === "analyst" ||
    r === "auditor" ||
    r === "campus_dispatch" ||
    r === "campus_security" ||
    r === "campus_supervisor" ||
    r === "venue_operator" ||
    r === "venue_security" ||
    r === "venue_supervisor"
  );
}
