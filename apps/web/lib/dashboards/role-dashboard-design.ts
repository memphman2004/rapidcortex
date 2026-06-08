import type { UserRole } from "rapid-cortex-shared/types";
import { migrateLegacyRapidCortexRoleTokenValue } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import type { DashboardPrefix } from "@/lib/dashboards/dashboard-access";

/** Enterprise identity + accent palette for role dashboards. */
export type RoleDashboardIdentity = {
  identityTitle: string;
  identitySubtitle: string;
  /** Primary accent — top bars, active nav, pulses */
  accent: string;
  /** Dim surface tone for headers / panels */
  dim: string;
  /** Badge background */
  badgeBg: string;
  /** Tinted text on dark surfaces */
  textColor: string;
  /** Softer accent for borders / hovers */
  accentMuted: string;
  /** Glow for pulses */
  accentGlow: string;
};

type PaletteSeed = {
  identityTitle: string;
  identitySubtitle: string;
  accent: string;
  dim: string;
  badgeBg: string;
  textColor: string;
};

function withAccents(seed: PaletteSeed): RoleDashboardIdentity {
  return {
    ...seed,
    accentMuted: `color-mix(in srgb, ${seed.accent} 35%, transparent)`,
    accentGlow: `color-mix(in srgb, ${seed.accent} 55%, transparent)`,
  };
}

/** Canonical palettes aligned to Rapid Cortex role dashboard color spec. */
export const ROLE_DASHBOARD_PALETTE_BY_ROLE: Record<UserRole, RoleDashboardIdentity> = {
  rcsuperadmin: withAccents({
    identityTitle: "Platform Command",
    identitySubtitle: "Global control",
    accent: "#C084FC",
    dim: "#3B1157",
    badgeBg: "#7E22CE",
    textColor: "#F3E8FF",
  }),
  rcadmin: withAccents({
    identityTitle: "Operations Command",
    identitySubtitle: "Billing & agencies",
    accent: "#0EA5E9",
    dim: "#0C4A6E",
    badgeBg: "#0369A1",
    textColor: "#E0F2FE",
  }),
  rcitadmin: withAccents({
    identityTitle: "Infrastructure & Support",
    identitySubtitle: "Cross-tenant",
    accent: "#06B6D4",
    dim: "#164E63",
    badgeBg: "#0E7490",
    textColor: "#CFFAFE",
  }),
  agencyadmin: withAccents({
    identityTitle: "Agency Management",
    identitySubtitle: "Users & settings",
    accent: "#10B981",
    dim: "#064E3B",
    badgeBg: "#047857",
    textColor: "#D1FAE5",
  }),
  agencyit: withAccents({
    identityTitle: "Integration & Systems",
    identitySubtitle: "CAD & API",
    accent: "#14B8A6",
    dim: "#134E4A",
    badgeBg: "#0F766E",
    textColor: "#CCFBF1",
  }),
  supervisor: withAccents({
    identityTitle: "Comms Supervision",
    identitySubtitle: "QA & coaching",
    accent: "#F59E0B",
    dim: "#78350F",
    badgeBg: "#B45309",
    textColor: "#FEF3C7",
  }),
  dispatcher: withAccents({
    identityTitle: "Live Call Workspace",
    identitySubtitle: "Primary ops role",
    accent: "#0284C7",
    dim: "#0C4A6E",
    badgeBg: "#0369A1",
    textColor: "#E0F2FE",
  }),
  analyst: withAccents({
    identityTitle: "QA Review",
    identitySubtitle: "Quality assurance — not live dispatch",
    accent: "#2DD4BF",
    dim: "#134E4A",
    badgeBg: "#0F766E",
    textColor: "#CCFBF1",
  }),
  auditor: withAccents({
    identityTitle: "Compliance & Audit",
    identitySubtitle: "Review only",
    accent: "#F87171",
    dim: "#7F1D1D",
    badgeBg: "#B91C1C",
    textColor: "#FEE2E2",
  }),
  hospitaladmin: withAccents({
    identityTitle: "Hospital Safety & Operations",
    identitySubtitle: "MCI routing",
    accent: "#0D9488",
    dim: "#134E4A",
    badgeBg: "#0F766E",
    textColor: "#CCFBF1",
  }),
  hospitalstaff: withAccents({
    identityTitle: "Hospital Capacity",
    identitySubtitle: "Live bed status · diversion updates",
    accent: "#0D9488",
    dim: "#134E4A",
    badgeBg: "#0F766E",
    textColor: "#CCFBF1",
  }),
};

/** Vertical product palettes (venue / campus) when surfaced in agency contexts. */
export const VERTICAL_DASHBOARD_PALETTE = {
  venue: withAccents({
    identityTitle: "Venue Security Command",
    identitySubtitle: "Crowd & events",
    accent: "#FB923C",
    dim: "#7C2D12",
    badgeBg: "#C2410C",
    textColor: "#FFEDD5",
  }),
  campus: withAccents({
    identityTitle: "Campus Safety Operations",
    identitySubtitle: "K-12 & university",
    accent: "#34D399",
    dim: "#064E3B",
    badgeBg: "#059669",
    textColor: "#D1FAE5",
  }),
} as const;

const PREFIX_DEFAULT_ROLE: Record<DashboardPrefix, UserRole> = {
  "rc-admin": "rcsuperadmin",
  "agency-admin": "agencyadmin",
  dispatcher: "dispatcher",
  supervisor: "supervisor",
  qa: "analyst",
  "it-security": "agencyit",
  executive: "auditor",
  "hospital-admin": "hospitaladmin",
  "hospital-staff": "hospitalstaff",
};

/** @deprecated Use role-aware identity; kept for callers without a user role. */
export const ROLE_DASHBOARD_IDENTITY: Record<DashboardPrefix, RoleDashboardIdentity> = {
  "rc-admin": ROLE_DASHBOARD_PALETTE_BY_ROLE.rcsuperadmin,
  "agency-admin": ROLE_DASHBOARD_PALETTE_BY_ROLE.agencyadmin,
  dispatcher: ROLE_DASHBOARD_PALETTE_BY_ROLE.dispatcher,
  supervisor: ROLE_DASHBOARD_PALETTE_BY_ROLE.supervisor,
  qa: ROLE_DASHBOARD_PALETTE_BY_ROLE.analyst,
  "it-security": ROLE_DASHBOARD_PALETTE_BY_ROLE.agencyit,
  executive: ROLE_DASHBOARD_PALETTE_BY_ROLE.auditor,
  "hospital-admin": ROLE_DASHBOARD_PALETTE_BY_ROLE.hospitaladmin,
  "hospital-staff": ROLE_DASHBOARD_PALETTE_BY_ROLE.hospitalstaff,
};

export function resolveDashboardRole(role: string | null | undefined): UserRole | null {
  const token = migrateLegacyRapidCortexRoleTokenValue(role?.trim() ?? "") ?? role?.trim();
  if (!token) return null;
  if (token in ROLE_DASHBOARD_PALETTE_BY_ROLE) return token as UserRole;
  return null;
}

export function getRoleDashboardIdentity(
  prefix: DashboardPrefix,
  role?: string | null,
): RoleDashboardIdentity {
  const resolved = resolveDashboardRole(role);
  if (resolved) return ROLE_DASHBOARD_PALETTE_BY_ROLE[resolved];
  return ROLE_DASHBOARD_IDENTITY[prefix];
}

export function roleDashboardShellVars(identity: RoleDashboardIdentity): Record<string, string> {
  return {
    "--role-accent": identity.accent,
    "--role-accent-dim": identity.dim,
    "--role-badge-bg": identity.badgeBg,
    "--role-text-accent": identity.textColor,
    "--role-accent-muted": identity.accentMuted,
    "--role-accent-glow": identity.accentGlow,
  };
}
