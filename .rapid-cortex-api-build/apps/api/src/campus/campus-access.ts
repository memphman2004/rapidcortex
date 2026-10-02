import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { AgencyRepository } from "../repositories/agencyRepository.js";

export function normalizeCampusCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

/** Org code embedded in campus agencyIds (e.g. last-campus-uga / test-campus-uga → UGA). */
export function campusCodeFromAgencyId(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?campus-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

/** True when the signed-in user may access data for this campus org code. */
export function canAccessCampusTenant(user: UserContext, campusCode: string): boolean {
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  const agencyId = user.agencyId ?? "";
  if (!agencyId) return false;
  return campusCodeFromAgencyId(agencyId) === normalizeCampusCode(campusCode);
}

/**
 * Resolve tenant agencyId from a campus org code for public/SMS intake
 * (camera registry + websocket rooms are keyed by agencyId).
 */
export async function resolveCampusAgencyId(campusCode: string): Promise<string | null> {
  const code = normalizeCampusCode(campusCode);
  if (!code) return null;
  const lower = code.toLowerCase();
  const agencies = new AgencyRepository();
  const candidates = [`test-campus-${lower}`, `campus-${lower}`, `last-campus-${lower}`];
  for (const id of candidates) {
    const hit = await agencies.get(id);
    if (hit) return id;
  }
  const ids = await agencies.listAgencyIds();
  return ids.find((id) => campusCodeFromAgencyId(id) === code) ?? null;
}
