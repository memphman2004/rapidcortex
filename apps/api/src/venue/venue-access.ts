import type { UserContext } from "rapid-cortex-shared";

export function normalizeVenueCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, "");
}

/** True when the signed-in user may access data for this venue code. */
export function canAccessVenueTenant(user: UserContext, venueCode: string): boolean {
  const agencyId = user.agencyId ?? "";
  if (agencyId.startsWith("rc") || agencyId.startsWith("RC")) return true;
  const normalizedAgency = agencyId.replace(/^(test-)?venue-/, "").toUpperCase().replace(/-/g, "");
  return normalizedAgency === normalizeVenueCode(venueCode);
}
