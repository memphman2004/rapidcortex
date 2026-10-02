import type { UserContext } from "rapid-cortex-shared";
import { isRcInternalOperator } from "rapid-cortex-shared";
import { AgencyRepository } from "../repositories/agencyRepository.js";

export function normalizeVenueCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

/** Org code embedded in venue agencyIds (e.g. last-venue-acme / test-venue-acme → ACME). */
export function venueCodeFromAgencyId(agencyId: string): string {
  const raw = agencyId.trim();
  const match = raw.match(/(?:test-)?venue-(.+)$/i);
  return (match?.[1] ?? raw).toUpperCase().replace(/-/g, "");
}

/** True when the signed-in user may access data for this venue code. */
export function canAccessVenueTenant(user: UserContext, venueCode: string): boolean {
  const agencyId = user.agencyId ?? "";
  if (isRcInternalOperator(user.role)) return true;
  if (user.role.trim().toLowerCase() === "agencyit") return true;
  if (!agencyId) return false;
  return venueCodeFromAgencyId(agencyId) === normalizeVenueCode(venueCode);
}

export async function resolveVenueAgencyId(venueCode: string): Promise<string | null> {
  const code = normalizeVenueCode(venueCode);
  if (!code) return null;
  const lower = code.toLowerCase();
  const agencies = new AgencyRepository();
  const candidates = [`test-venue-${lower}`, `venue-${lower}`, `last-venue-${lower}`];
  for (const id of candidates) {
    const hit = await agencies.get(id);
    if (hit) return id;
  }
  const ids = await agencies.listAgencyIds();
  return ids.find((id) => venueCodeFromAgencyId(id) === code) ?? null;
}
