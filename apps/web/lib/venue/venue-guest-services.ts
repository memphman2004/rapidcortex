import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";

/** Persistent liability copy — spec Section 5, VENUE_GUEST_SERVICES. */
export const VENUE_GUEST_SERVICES_DISCLAIMER =
  "NOT A 911 EMERGENCY DISPATCH SYSTEM";

/** True when the session role is venue guest / guest-services (any alias or casing). */
export function isVenueGuestServicesRole(role: string | null | undefined): boolean {
  const raw = (role ?? "").trim();
  if (!raw) return false;
  const upper = raw.toUpperCase();
  if (upper === "VENUE_GUEST_SERVICES" || upper === "VENUE_GUEST") return true;
  const migrated = migrateLegacyRapidCortexRoleTokenValue(raw);
  return migrated === "venue_guest";
}
