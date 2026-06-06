import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { UserContext } from "rapid-cortex-shared/types";
import { parsePasswordChangeRequiredFlag } from "rapid-cortex-shared/auth/password-policy";
import {
  migrateLegacyRapidCortexRoleTokenValue,
  isRapidCortexRole,
} from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { PLATFORM_AGENCY_ID } from "rapid-cortex-shared/tenancy/constants";
import {
  getCognitoClientId,
  getCognitoRegion,
  getCognitoUserPoolId,
} from "@/lib/auth/cognito-config";
import { normalizeRole } from "./roles";

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
const CJIS_UNAUTH_BYPASS_ERROR =
  "CJIS VIOLATION: Unauthenticated API mode not allowed in production";

export function assertFailClosedUnauthenticatedMode(): void {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.ALLOW_UNAUTHENTICATED_API === "true"
  ) {
    throw new Error(CJIS_UNAUTH_BYPASS_ERROR);
  }
}

function getJwks(issuer: string) {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

function issuerFromEnv(): string | null {
  const poolId = getCognitoUserPoolId();
  const region = getCognitoRegion();
  if (!poolId) return null;
  return `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
}

function resolveRoleClaims(payload: JWTPayload): string {
  /** Primary source of truth — keep in sync with `resolveRoleFromJwtPayload` in `apps/api/src/lib/auth.ts`. */
  const rawCustom = payload["custom:role"];
  if (rawCustom != null && String(rawCustom).trim()) return String(rawCustom).trim();

  const preferred = payload["preferred_role"];
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();

  const groupsRaw = payload["cognito:groups"];
  const groups = Array.isArray(groupsRaw) ? groupsRaw : [];
  for (const g of groups) {
    const segment = String(g).trim();
    if (!segment) continue;
    const migrated = migrateLegacyRapidCortexRoleTokenValue(segment) ?? segment;
    if (isRapidCortexRole(migrated)) return migrated;
  }
  return "";
}

/** Status values that invalidate an otherwise valid ID token for session purposes. */
const BLOCKED_ACCOUNT_STATUS = new Set(["inactive", "disabled", "suspended", "archived"]);

export function mapJwtToUser(payload: JWTPayload): UserContext | null {
  const sub = payload.sub;
  if (!sub) return null;
  const role = normalizeRole(resolveRoleClaims(payload));
  let agencyId = String(payload["custom:agencyId"] ?? "").trim();
  if (role === "rcsuperadmin") {
    agencyId = agencyId || PLATFORM_AGENCY_ID;
  }
  if (!agencyId) return null;
  const accountStatus = String(payload["custom:status"] ?? "").trim();
  const user: UserContext & Record<string, unknown> = {
    userId: String(sub),
    agencyId,
    role,
    email: String(payload.email ?? payload["cognito:username"] ?? ""),
    ...(accountStatus ? { accountStatus } : {}),
  };
  const subscriptionStatus = String(
    payload["custom:subStatus"] ??
      payload["custom:subscriptionLifecycle"] ??
      "",
  ).trim();
  const planId = String(
    payload["custom:planId"] ?? payload["custom:subscriptionPlanId"] ?? "",
  ).trim();
  const isSubscriberRaw =
    payload["custom:isSubscriber"] ?? payload["custom:subscriber"];
  if (subscriptionStatus) {
    user.subscriptionStatus = subscriptionStatus;
  }
  if (planId) {
    user.planId = planId;
  }
  if (typeof isSubscriberRaw === "boolean") {
    user.isSubscriber = isSubscriberRaw;
  } else if (typeof isSubscriberRaw === "string") {
    const v = isSubscriberRaw.trim().toLowerCase();
    if (["1", "true", "yes", "y", "active", "subscribed"].includes(v)) {
      user.isSubscriber = true;
    } else if (["0", "false", "no", "n", "inactive", "unsubscribed"].includes(v)) {
      user.isSubscriber = false;
    }
  }
  const statusLower = String(payload["custom:status"] ?? "").trim().toLowerCase();
  /** Treat missing status as usable: many pools omit custom:status until migration; rejecting "" caused post-login loops. */
  if (statusLower && BLOCKED_ACCOUNT_STATUS.has(statusLower)) return null;
  const dashboardAccess = String(
    payload["custom:dashboardAccess"] ?? payload["custom:allowedDashboards"] ?? "",
  )
    .trim()
    .toLowerCase();
  if (dashboardAccess) {
    user.dashboardAccess = dashboardAccess;
  }
  const customerType = String(payload["custom:customerType"] ?? "").trim();
  if (customerType) {
    user.customerType = customerType;
  }
  const subscriptionProduct = String(payload["custom:subscriptionProduct"] ?? "").trim();
  if (subscriptionProduct) {
    user.subscriptionProduct = subscriptionProduct;
  }
  const sessionEntitlements = String(payload["custom:entitlements"] ?? "").trim();
  if (sessionEntitlements) {
    user.sessionEntitlements = sessionEntitlements;
  }
  const passwordLastChangedAt = String(payload["custom:pwdChangedAt"] ?? "").trim();
  if (passwordLastChangedAt) {
    user.passwordLastChangedAt = passwordLastChangedAt;
  }
  const pcrRaw = payload["custom:pwdChangeReq"];
  if (pcrRaw != null && String(pcrRaw).trim() !== "") {
    user.passwordChangeRequired = parsePasswordChangeRequiredFlag(pcrRaw);
  }
  const hospitalId = String(payload["custom:hospitalId"] ?? "").trim();
  if (hospitalId) {
    user.hospitalId = hospitalId;
  }
  const firstName = String(payload["custom:firstName"] ?? "").trim();
  const lastName = String(payload["custom:lastName"] ?? "").trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (displayName) {
    user.displayName = displayName;
  }
  return user;
}

export async function verifyCognitoIdToken(token: string): Promise<UserContext | null> {
  const issuer = issuerFromEnv();
  const clientId = getCognitoClientId();
  if (!issuer || !clientId) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(issuer), {
      issuer,
      audience: clientId,
    });
    if (payload.token_use != null && payload.token_use !== "id") return null;
    return mapJwtToUser(payload);
  } catch {
    return null;
  }
}

// Fail closed at module load for web auth paths too.
assertFailClosedUnauthenticatedMode();
