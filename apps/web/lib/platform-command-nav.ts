/** Absolute RC Admin shell paths for internal platform command (no jurisdiction prefix). */
export const RC_PLATFORM_COMMAND_PATHS = {
  dashboard: "/rc-admin/dashboard",
  infrastructure: "/rc-admin/infrastructure",
  agencies: "/rc-admin/agencies",
  agenciesNew: "/rc-admin/agencies/new",
  users: "/rc-admin/users",
  onboarding: "/rc-admin/onboarding",
  integrations: "/rc-admin/integrations",
  audit: "/rc-admin/audit",
  support: "/rc-admin/support",
  billing: "/rc-admin/billing",
  systemHealth: "/rc-admin/system-health",
  access: "/rc-admin/access",
  operations: "/rc-admin/operations",
  usage: "/rc-admin/usage",
  plans: "/rc-admin/plans",
  invoices: "/rc-admin/invoices",
  addOns: "/rc-admin/add-ons",
  apiClients: "/rc-admin/api-clients",
} as const;

/** Dispatch workstation sidebar — platform ops only (no dispatcher workflow). */
export const RC_ADMIN_SIDEBAR_NAV: ReadonlyArray<{ path: string; label: string }> = [
  { path: RC_PLATFORM_COMMAND_PATHS.dashboard, label: "Overview" },
  { path: RC_PLATFORM_COMMAND_PATHS.infrastructure, label: "Infrastructure" },
  { path: RC_PLATFORM_COMMAND_PATHS.operations, label: "Operations" },
  { path: RC_PLATFORM_COMMAND_PATHS.billing, label: "Billing" },
  { path: RC_PLATFORM_COMMAND_PATHS.plans, label: "Plans" },
  { path: RC_PLATFORM_COMMAND_PATHS.apiClients, label: "Tenant API clients" },
  { path: RC_PLATFORM_COMMAND_PATHS.agencies, label: "Agencies" },
  { path: RC_PLATFORM_COMMAND_PATHS.users, label: "Users" },
  { path: RC_PLATFORM_COMMAND_PATHS.access, label: "Feature access" },
  { path: RC_PLATFORM_COMMAND_PATHS.onboarding, label: "Onboarding" },
  { path: RC_PLATFORM_COMMAND_PATHS.usage, label: "API Usage" },
  { path: RC_PLATFORM_COMMAND_PATHS.invoices, label: "Invoices" },
  { path: RC_PLATFORM_COMMAND_PATHS.addOns, label: "Add-ons" },
];

const JURISDICTION_PLATFORM_SUFFIX: Record<string, string> = {
  "/admin/platform/dashboard": RC_PLATFORM_COMMAND_PATHS.dashboard,
  "/admin/platform/agencies": RC_PLATFORM_COMMAND_PATHS.agencies,
  "/admin/platform/agencies/new": RC_PLATFORM_COMMAND_PATHS.agenciesNew,
  "/admin/platform/users": RC_PLATFORM_COMMAND_PATHS.users,
  "/admin/platform/onboarding": RC_PLATFORM_COMMAND_PATHS.onboarding,
  "/admin/platform/integrations": RC_PLATFORM_COMMAND_PATHS.integrations,
  "/admin/platform/audit": RC_PLATFORM_COMMAND_PATHS.audit,
  "/admin/platform/support": RC_PLATFORM_COMMAND_PATHS.support,
  "/admin/platform/billing": RC_PLATFORM_COMMAND_PATHS.billing,
  "/admin/platform/system-health": RC_PLATFORM_COMMAND_PATHS.systemHealth,
  "/admin/platform/access": RC_PLATFORM_COMMAND_PATHS.access,
};

/** Map `/{jurisdiction}/admin/platform/...` to `/rc-admin/...` when applicable. */
export function mapJurisdictionPlatformPathToRcAdmin(pathname: string): string | null {
  const match = pathname.match(/^\/[^/]+(\/admin\/platform(?:\/[^?]*)?)/);
  if (!match) return null;
  const suffix = match[1].replace(/\/$/, "") || "/admin/platform/dashboard";
  const exact = JURISDICTION_PLATFORM_SUFFIX[suffix];
  if (exact) return exact;
  if (suffix.startsWith("/admin/platform/agencies/") && !suffix.endsWith("/new")) {
    const agencyId = suffix.slice("/admin/platform/agencies/".length);
    if (agencyId && !agencyId.includes("/")) {
      return `${RC_PLATFORM_COMMAND_PATHS.agencies}/${agencyId}`;
    }
  }
  return null;
}
