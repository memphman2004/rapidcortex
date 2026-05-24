import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { UserContext } from "rapid-cortex-shared";
import {
  PLATFORM_AGENCY_ID,
  isRapidCortexRole,
  migrateLegacyRapidCortexRoleTokenValue,
} from "rapid-cortex-shared";
import { persistAuthContextTouch } from "../handlers/deception/deceptionPersist.js";
import { detectHoneytokenBlock } from "../handlers/deception/honeytokenGate.js";
import { networkAccessMiddleware } from "../middleware/network-access.js";
import { env } from "./env.js";
import { normalizeRole } from "./authz.js";

export const ACCOUNT_INACTIVE_MESSAGE = "User account is not active.";

/** Align with web session: missing status is usable; only explicit blocked values deny API access. */
const BLOCKED_ACCOUNT_STATUS = new Set(["inactive", "disabled", "suspended", "archived"]);
export const CJIS_UNAUTH_BYPASS_ERROR =
  "CJIS VIOLATION: Unauthenticated API mode not allowed in production";
const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(issuer: string) {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

/**
 * Role resolution matches `resolveRoleClaims` in `apps/web/lib/auth/verify-cognito.ts`:
 * `custom:role` first, then `preferred_role`, then first known canonical role in `cognito:groups`.
 */
function resolveRoleFromJwtPayload(payload: JWTPayload): string {
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

function mapPayload(payload: JWTPayload): UserContext | null {
  const sub = payload.sub;
  if (!sub) return null;
  const role = normalizeRole(resolveRoleFromJwtPayload(payload));
  let agencyId = String(payload["custom:agencyId"] ?? "").trim();
  if (role === "rcsuperadmin") {
    agencyId = agencyId || PLATFORM_AGENCY_ID;
  }
  if (!agencyId) return null;
  const accountStatus = String(payload["custom:status"] ?? "").trim();
  const passwordLastRaw = String(payload["custom:pwdChangedAt"] ?? "").trim();
  const passwordChangeRaw = payload["custom:pwdChangeReq"];
  const passwordChangeRequired = mapPasswordChangeRequiredClaim(passwordChangeRaw);
  const planId = String(payload["custom:planId"] ?? payload["custom:subscriptionPlanId"] ?? "").trim();
  const hospitalId = String(payload["custom:hospitalId"] ?? "").trim();
  const firstName = String(payload["custom:firstName"] ?? "").trim();
  const lastName = String(payload["custom:lastName"] ?? "").trim();
  const displayName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    userId: String(sub),
    agencyId,
    role,
    email: String(payload.email ?? payload["cognito:username"] ?? ""),
    ...(accountStatus ? { accountStatus } : {}),
    ...(planId ? { planId } : {}),
    ...(passwordLastRaw ? { passwordLastChangedAt: passwordLastRaw } : {}),
    ...(passwordChangeRequired !== undefined ? { passwordChangeRequired } : {}),
    ...(hospitalId ? { hospitalId } : {}),
    ...(displayName ? { displayName } : {}),
  };
}

function mapPasswordChangeRequiredClaim(raw: unknown): boolean | string | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).trim();
  if (!s) return undefined;
  const low = s.toLowerCase();
  if (low === "true" || low === "1" || low === "yes") return true;
  if (low === "false" || low === "0" || low === "no") return false;
  return s;
}

async function verifyBearerToken(token: string): Promise<UserContext | null> {
  const poolId = process.env.COGNITO_USER_POOL_ID;
  const region = process.env.COGNITO_REGION;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!poolId || !region || !clientId) return null;

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const jwks = getJwks(issuer);

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: clientId,
    });
    if (payload.token_use != null && payload.token_use !== "id") return null;
    return mapPayload(payload);
  } catch {
    return null;
  }
}

function demoUser(): UserContext {
  return {
    userId: "demo-user",
    agencyId: "demo-agency",
    role: "dispatcher",
    email: "demo@rapidcortex.ai",
    passwordLastChangedAt: new Date().toISOString(),
    passwordChangeRequired: false,
  };
}

export function assertFailClosedUnauthenticatedMode(): void {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.ALLOW_UNAUTHENTICATED_API === "true"
  ) {
    throw new Error(CJIS_UNAUTH_BYPASS_ERROR);
  }
}

export function isUserAccountActive(user: Pick<UserContext, "accountStatus">): boolean {
  const s = user.accountStatus?.trim().toLowerCase() ?? "";
  if (!s) return true;
  return !BLOCKED_ACCOUNT_STATUS.has(s);
}

// Fail closed at cold start for CJIS posture.
assertFailClosedUnauthenticatedMode();

async function applyNetworkAccessGate(
  event: APIGatewayProxyEventV2,
  ctx: UserContext,
): Promise<UserContext | null> {
  if (!env.networkAccessEnforcement) return ctx;
  try {
    const net = await networkAccessMiddleware(event, ctx);
    if (!net.allowed) return null;
    return ctx;
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "network_access_gate_error",
        userId: ctx.userId,
        agencyId: ctx.agencyId,
        path: event.rawPath,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    // Degraded mode: policy store/WAF misconfig must not return 500 for unrelated routes.
    return ctx;
  }
}

/** Verify a raw Cognito id token (e.g. WebSocket $connect query param). */
export async function getUserContextFromIdToken(
  token: string,
  event?: APIGatewayProxyEventV2,
): Promise<UserContext | null> {
  const ctx = await verifyBearerToken(token.trim());
  if (!ctx || !isUserAccountActive(ctx)) return null;
  if (event) return applyNetworkAccessGate(event, ctx);
  return ctx;
}

export async function getUserContext(
  event: APIGatewayProxyEventV2,
  options?: { skipNetworkAccess?: boolean },
): Promise<UserContext | null> {
  const ctx = await getUserContextWithoutNetwork(event);
  if (!ctx) return null;
  if (options?.skipNetworkAccess) return ctx;
  return applyNetworkAccessGate(event, ctx);
}

export async function getUserContextWithoutNetwork(
  event: APIGatewayProxyEventV2,
): Promise<UserContext | null> {
  const allowUnauth = process.env.ALLOW_UNAUTHENTICATED_API === "true";

  if (process.env.DECEPTION_SHIELD_ENABLED === "true" && process.env.DECEPTION_EVENTS_TABLE?.trim()) {
    if (await detectHoneytokenBlock(event)) {
      return null;
    }
  }

  const hdr =
    event.headers?.authorization ??
    event.headers?.Authorization ??
    event.headers?.["authorization"];
  const match = hdr?.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) {
    const ctx = await verifyBearerToken(match[1].trim());
    if (ctx && isUserAccountActive(ctx)) {
      if (process.env.DECEPTION_SHIELD_ENABLED === "true" && process.env.DECEPTION_EVENTS_TABLE?.trim()) {
        void persistAuthContextTouch(event, {
          userId: ctx.userId,
          agencyId: ctx.agencyId,
        }).catch(() => {});
      }
      return ctx;
    }
    return null;
  }

  const claims = (
    event.requestContext as { authorizer?: { jwt?: { claims?: JWTPayload } } }
  ).authorizer?.jwt?.claims;
  if (claims?.sub) {
    const mapped = mapPayload(claims);
    if (mapped && isUserAccountActive(mapped)) {
      if (process.env.DECEPTION_SHIELD_ENABLED === "true" && process.env.DECEPTION_EVENTS_TABLE?.trim()) {
        void persistAuthContextTouch(event, {
          userId: mapped.userId,
          agencyId: mapped.agencyId,
        }).catch(() => {});
      }
      return mapped;
    }
    return null;
  }

  if (allowUnauth) return demoUser();
  return null;
}
