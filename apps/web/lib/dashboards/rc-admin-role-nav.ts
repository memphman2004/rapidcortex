import { isRcItAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { NavTab } from "./role-dashboard-config";

function effectiveRole(role: string): string {
  return migrateLegacyRapidCortexRoleTokenValue(role) ?? role;
}

/** rcsuperadmin — spec section 1 (Grants omitted until roadmap ships). */
const RC_SUPERADMIN_NAV: NavTab[] = [
  { id: "overview", label: "Platform overview", href: "/rc-admin/dashboard" },
  { id: "agencies", label: "Agencies", href: "/rc-admin/agencies" },
  { id: "users", label: "Users", href: "/rc-admin/users" },
  { id: "billing", label: "Billing", href: "/rc-admin/billing" },
  { id: "infrastructure", label: "Infrastructure", href: "/rc-admin/infrastructure" },
  { id: "audit", label: "Audit log", href: "/rc-admin/audit" },
  { id: "support", label: "Platform notices", href: "/rc-admin/support" },
  { id: "feature-flags", label: "Feature flags", href: "/rc-admin/access" },
  { id: "api-clients", label: "Developer portal", href: "/rc-admin/api-clients" },
  { id: "location-qr", label: "Location QR Codes", href: "/rc-admin/location-qr-codes" },
  { id: "settings", label: "Settings", href: "/rc-admin/operations" },
];

/** rcadmin — business/operations; no infrastructure or feature flags. */
const RC_BUSINESS_ADMIN_NAV: NavTab[] = [
  { id: "overview", label: "Platform overview", href: "/rc-admin/dashboard" },
  { id: "agencies", label: "Agencies", href: "/rc-admin/agencies" },
  { id: "users", label: "Users", href: "/rc-admin/users" },
  { id: "billing", label: "Billing", href: "/rc-admin/billing" },
  { id: "service-catalog", label: "Service catalog", href: "/rc-admin/billing/services" },
  { id: "support", label: "Platform notices", href: "/rc-admin/support" },
  { id: "api-clients", label: "Developer portal", href: "/rc-admin/api-clients" },
  { id: "location-qr", label: "Location QR Codes", href: "/rc-admin/location-qr-codes" },
  { id: "reports", label: "Reports", href: "/rc-admin/usage" },
  { id: "audit", label: "Audit log", href: "/rc-admin/audit" },
];

/** rcitadmin — infrastructure home; no billing or business surfaces. */
const RC_IT_ADMIN_NAV: NavTab[] = [
  { id: "infrastructure", label: "Infrastructure overview", href: "/rc-admin/infrastructure" },
  { id: "system-health", label: "System health", href: "/rc-admin/system-health" },
  { id: "integrations", label: "Integrations", href: "/rc-admin/integrations" },
  { id: "users", label: "Users", href: "/rc-admin/users" },
  { id: "audit", label: "Audit log", href: "/rc-admin/audit" },
  { id: "system-settings", label: "System settings", href: "/rc-admin/system-settings" },
  { id: "cad-admin", label: "CAD administration", href: "/rc-admin/integrations" },
  { id: "security", label: "Security", href: "/rc-admin/security" },
  { id: "location-qr", label: "Location QR Codes", href: "/rc-admin/location-qr-codes" },
];

/** Canonical RC Admin sidebar per internal role — spec section 1. */
export function rcAdminNavForRole(role: string): NavTab[] {
  const r = effectiveRole(role);
  if (isRcSuperAdmin(r)) return RC_SUPERADMIN_NAV;
  if (isRcItAdmin(r)) return RC_IT_ADMIN_NAV;
  if (r === "rcadmin") return RC_BUSINESS_ADMIN_NAV;
  return [];
}

/** RC Admin sidebar scoped per internal role — no cross-role tool links. */
export function filterRcAdminNavTabs(_tabs: NavTab[], role: string): NavTab[] {
  return rcAdminNavForRole(role);
}

export type RcPlatformNavItem = { path: string; label: string };

/** Jurisdiction dispatch sidebar platform section (RC internal roles). */
export function rcPlatformSidebarNavForRole(role: string): readonly RcPlatformNavItem[] {
  return rcAdminNavForRole(role)
    .filter((tab): tab is NavTab & { href: string } => Boolean(tab.href))
    .map((tab) => ({ path: tab.href, label: tab.label }));
}

/** Post-login / index redirect target for RC internal roles. */
export function rcAdminHomeHrefForRole(role: string): string {
  const r = effectiveRole(role);
  if (isRcItAdmin(r) && !isRcSuperAdmin(r)) return "/rc-admin/infrastructure";
  return "/rc-admin/dashboard";
}
