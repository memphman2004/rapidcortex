/**
 * Post-auth redirect utility — JWT claims only (no DB lookup).
 *
 * Priority:
 *   1. Safe ?next= query param
 *   2. Vertical workspace URL for campus / venue / hospital / transit users
 *   3. /rc-admin for platform staff
 *   4. /dashboard for RC Core agency users
 */

import { verticalFromRole } from "rapid-cortex-shared";
import { buildWorkspaceUrl, normalizeVerticalRoleToken, resolveRoleRoute } from "@/lib/role-routing";

export interface AuthenticatedUser {
  role: string;
  agencyId?: string;
  vertical?: string;
  email?: string;
}

const VERTICAL_WORKSPACES = new Set(["campus", "venue", "hospital", "transit"]);

const PLATFORM_ROLES = new Set(["rcsuperadmin", "rcadmin", "rcitadmin", "platform_owner"]);

export function getPostAuthRedirect(
  user: AuthenticatedUser,
  nextParam?: string | null,
): string {
  if (nextParam && isSafeRedirect(nextParam)) {
    return nextParam;
  }

  const role = normalizeVerticalRoleToken(user.role);

  if (PLATFORM_ROLES.has(role)) {
    return "/rc-admin";
  }

  const vertical = user.vertical?.trim() || inferVerticalFromRole(role);
  if (vertical && VERTICAL_WORKSPACES.has(vertical)) {
    return buildWorkspaceUrl(vertical, role, user.agencyId ?? "");
  }

  const productRoute = resolveRoleRoute(role, user.agencyId ?? "");
  if (productRoute.startsWith("/app/")) {
    return productRoute;
  }

  return "/dashboard";
}

function inferVerticalFromRole(role: string): string | undefined {
  const fromRole = verticalFromRole(role);
  if (fromRole === "911" || fromRole === "platform") return undefined;
  return fromRole;
}

function isSafeRedirect(url: string): boolean {
  if (!url.startsWith("/")) return false;
  if (url.startsWith("//")) return false;
  if (url.includes("://")) return false;
  const blocked = ["/signin", "/sign-in", "/change-password", "/auth"];
  if (blocked.some((b) => url.startsWith(b))) return false;
  return true;
}

/** Decode JWT payload without verifying signature (Cognito already verified). */
export function decodeJwtClaims(token: string): Record<string, string> {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = Buffer.from(padded, "base64url").toString("utf-8");
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}
