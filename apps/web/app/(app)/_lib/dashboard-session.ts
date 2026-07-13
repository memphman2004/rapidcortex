import "server-only";

import { decodeJwt } from "jose";
import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import type { UserContext } from "rapid-cortex-shared/types";
import { PLATFORM_AGENCY_ID } from "rapid-cortex-shared/tenancy/constants";
import { isRcInternalOperator, isRcsuperadmin } from "rapid-cortex-shared/tenancy/principal";
import { COOKIE_ID_TOKEN } from "@/lib/auth/cookies";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";
import {
  deriveVerticalFromAgencyId,
  normalizeVertical,
  type Vertical as TenantVertical,
} from "@/lib/vertical";

export type DashboardRouteKey =
  | "rcsuperadmin"
  | "rcadmin"
  | "rcitadmin"
  | "agencyadmin"
  | "agencyit"
  | "supervisor"
  | "dispatcher"
  | "analyst"
  | "auditor"
  | "venue"
  | "campus"
  | "hospital";

export type AppDashboardSession = {
  user: UserContext;
  role: string;
  vertical: TenantVertical;
  agencyId: string;
  addons: string[];
  tenantLabel: string;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseAddons(raw: string): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function getDashboardRouteForRole(role: string): DashboardRouteKey | null {
  const token = role.trim();
  const lower = token.toLowerCase();
  const upper = token.toUpperCase();

  if (lower === "rcsuperadmin") return "rcsuperadmin";
  if (lower === "rcadmin") return "rcadmin";
  if (lower === "rcitadmin") return "rcitadmin";
  if (lower === "agencyadmin") return "agencyadmin";
  if (lower === "agencyit") return "agencyit";
  if (lower === "supervisor") return "supervisor";
  if (lower === "dispatcher") return "dispatcher";
  if (lower === "analyst") return "analyst";
  if (lower === "auditor") return "auditor";
  if (lower === "venue" || upper.startsWith("VENUE_")) return "venue";
  if (lower === "campus" || upper.startsWith("CAMPUS_")) return "campus";
  if (lower === "hospital" || upper.startsWith("HOSPITAL_")) return "hospital";

  return null;
}

export function dashboardPathForRoute(route: DashboardRouteKey): string {
  return `/dashboards/${route}`;
}

function safeDecodeJwt(token: string): Record<string, unknown> {
  try {
    return decodeJwt(token) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function resolveAgencyIdForSession(user: UserContext, payload: Record<string, unknown>): string {
  const fromClaim = asString(payload["custom:agencyId"]);
  const merged = fromClaim || user.agencyId?.trim() || "";
  if (merged) return merged;
  if (isRcsuperadmin(user) || isRcInternalOperator(user.role)) {
    return PLATFORM_AGENCY_ID;
  }
  return "";
}

export async function getAppDashboardSession(): Promise<AppDashboardSession> {
  const user = await getDashboardSessionUser();
  if (!user) {
    redirect(`${marketingLoginPath()}?from=/dashboard`);
  }

  const jar = await cookies();
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value;
  const payload = idToken ? safeDecodeJwt(idToken) : {};

  const claimRole = asString(payload["custom:role"]);
  const role = claimRole || user.role;
  const agencyId = resolveAgencyIdForSession(user, payload);
  if (!agencyId) {
    redirect("/unauthorized?reason=missing_agency");
  }
  const claimVertical = asString(payload["custom:vertical"]);
  const vertical = claimVertical
    ? normalizeVertical(claimVertical)
    : deriveVerticalFromAgencyId(agencyId);
  const addons = parseAddons(asString(payload["custom:addons"]));
  const tenantLabel = asString(payload["custom:tenantLabel"]) || agencyId;

  return { user: { ...user, agencyId }, role, vertical, agencyId, addons, tenantLabel };
}

export function assertRouteMatchesRole(route: DashboardRouteKey, session: AppDashboardSession): void {
  const expected = getDashboardRouteForRole(session.role);
  if (expected !== route) {
    forbidden();
  }
}
