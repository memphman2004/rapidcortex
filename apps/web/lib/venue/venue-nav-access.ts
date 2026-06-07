import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { roleMayAccessQrNav } from "@/lib/locations/qr-access";

export type VenueNavKey =
  | "dashboard"
  | "incidents"
  | "reports"
  | "qr"
  | "cameras"
  | "zones"
  | "analytics"
  | "settings";

const ALL_NAV: readonly VenueNavKey[] = [
  "dashboard",
  "incidents",
  "reports",
  "qr",
  "cameras",
  "zones",
  "analytics",
  "settings",
];

/** Venue sidebar items allowed per role — no PSAP/dispatcher tools. */
const VENUE_NAV_BY_ROLE: Record<string, readonly VenueNavKey[]> = {
  VENUE_ADMIN: ALL_NAV,
  VENUE_SUPERVISOR: ALL_NAV,
  VENUE_SECURITY: ["dashboard", "incidents", "reports", "cameras", "zones"],
  VENUE_OPERATOR: ["dashboard", "incidents"],
  VENUE_GUEST_SERVICES: ["dashboard", "reports"],
};

export function venueNavKeysForRole(role: string | undefined | null): readonly VenueNavKey[] {
  const upper = (role ?? "").trim().toUpperCase();
  return VENUE_NAV_BY_ROLE[upper] ?? VENUE_NAV_BY_ROLE.VENUE_SUPERVISOR;
}

export function canViewVenueNavItem(key: VenueNavKey, role: string | undefined | null): boolean {
  if (key === "qr" && !roleMayAccessQrNav(role)) return false;
  return venueNavKeysForRole(role).includes(key);
}

/** Campus sidebar — school safety intake only (no PSAP CAD/transcription tools). */
const CAMPUS_NAV_BY_ROLE: Record<string, readonly string[]> = {
  CAMPUS_ADMIN: ["dashboard", "incidents", "reports", "zones", "qr-codes"],
  CAMPUS_SUPERVISOR: ["dashboard", "incidents", "reports", "zones", "qr-codes"],
  CAMPUS_SECURITY: ["dashboard", "incidents", "reports", "qr-codes"],
  CAMPUS_DISPATCH: ["dashboard", "incidents"],
  CAMPUS_COUNSELOR: ["dashboard", "reports"],
  CAMPUS_FACULTY: ["dashboard", "reports"],
};

export function campusNavKeysForRole(role: string | undefined | null): readonly string[] {
  const upper = (role ?? "").trim().toUpperCase();
  if (upper in CAMPUS_NAV_BY_ROLE) return CAMPUS_NAV_BY_ROLE[upper];
  const migrated = migrateLegacyRapidCortexRoleTokenValue(role ?? "") ?? role ?? "";
  if (migrated === "agencyadmin") return CAMPUS_NAV_BY_ROLE.CAMPUS_ADMIN;
  if (migrated === "supervisor") return CAMPUS_NAV_BY_ROLE.CAMPUS_SUPERVISOR;
  if (migrated === "dispatcher") return CAMPUS_NAV_BY_ROLE.CAMPUS_DISPATCH;
  if (migrated === "analyst") return CAMPUS_NAV_BY_ROLE.CAMPUS_COUNSELOR;
  if (migrated === "auditor") return CAMPUS_NAV_BY_ROLE.CAMPUS_FACULTY;
  return CAMPUS_NAV_BY_ROLE.CAMPUS_SUPERVISOR;
}

export function canViewCampusNavItem(key: string, role: string | undefined | null): boolean {
  return campusNavKeysForRole(role).includes(key);
}
