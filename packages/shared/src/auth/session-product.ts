import { canonicalMonetizationPlanId, resolveFeatureEntitlements } from "../monetization/entitlements.js";
import type { UserContext } from "../types.js";
import { isRcInternalOperator } from "../tenancy/principal.js";

/** Parsed from Cognito `custom:customerType` — drives dashboard vs RC Lite portal routing when set. */
export type SessionCustomerType =
  | "rapid_cortex_platform"
  | "rc_lite_api"
  | "hybrid"
  | "platform_internal";

/** Session + commercial claims (JWT + shared `UserContext`). */
export type SessionProductExtras = UserContext;

const ACTIVE_SUBSCRIPTION_STATES = new Set([
  "active",
  "trialing",
  "past_due",
  "grace",
  "in_grace_period",
  "current",
]);

const INACTIVE_SUBSCRIPTION_STATES = new Set([
  "canceled",
  "cancelled",
  "inactive",
  "expired",
  "none",
  "free",
  "unpaid",
]);

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim().toLowerCase();
  return next.length > 0 ? next : null;
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (["1", "true", "yes", "y", "active", "subscribed"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "inactive", "unsubscribed"].includes(normalized)) return false;
  return null;
}

/**
 * Parses `custom:entitlements` claim: comma-separated flags or JSON `["a","b"]`.
 */
export function parseEntitlementsClaim(raw?: string | null): Set<string> {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return new Set();
  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(
        parsed
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      );
    }
  } catch {
    /* fallthrough */
  }
  return new Set(
    t
      .split(/[,|]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function entitlementsFromUser(user: SessionProductExtras): Set<string> {
  return parseEntitlementsClaim(user.sessionEntitlements);
}

/** True when JWT subscription fields indicate billable/active relationship (dashboard or RC Lite). */
export function hasActivePaidRelationship(user: SessionProductExtras | null | undefined): boolean {
  if (!user) return false;
  /** Operator / pilot users without billing SKUs in the token — requires `custom:customerType=platform_internal`. */
  const ct = user.customerType?.trim().toLowerCase();
  if (ct === "platform_internal") return true;

  const isSubscriber = normalizeBoolean(user.isSubscriber);
  if (isSubscriber != null) return isSubscriber;

  const status = normalizeString(user.subscriptionStatus);
  if (status && ACTIVE_SUBSCRIPTION_STATES.has(status)) return true;
  if (status && INACTIVE_SUBSCRIPTION_STATES.has(status)) return false;

  const planSlug = normalizeString(user.planId);
  if (planSlug && INACTIVE_SUBSCRIPTION_STATES.has(planSlug)) return false;

  return !!planSlug;
}

/**
 * Resolved customer archetype — prefers explicit JWT `custom:customerType`, else infers from `planId`.
 */
export function resolveSessionCustomerType(user: SessionProductExtras): SessionCustomerType | null {
  const raw = user.customerType?.trim().toLowerCase();
  if (
    raw === "rapid_cortex_platform" ||
    raw === "rc_lite_api" ||
    raw === "hybrid" ||
    raw === "platform_internal"
  ) {
    return raw as SessionCustomerType;
  }
  const pid = canonicalMonetizationPlanId(user.planId ?? "");
  if (pid === "rc_lite") return "rc_lite_api";
  if (pid === "essential" || pid === "command" || pid === "enterprise_statewide") {
    return "rapid_cortex_platform";
  }
  if (hasActivePaidRelationship(user)) return "rapid_cortex_platform";
  return null;
}

function dashboardAccessViaLegacyField(dashboardAccess?: string): boolean {
  const d = dashboardAccess?.trim().toLowerCase() ?? "";
  return d === "all" || d.includes("dashboard") || d.includes("dispatcher") || d.includes("full_platform");
}

/**
 * Operational Rapid Cortex dashboards (dispatcher, supervisor, agency admin, etc.).
 */
export function hasRapidCortexDashboardAccess(user: SessionProductExtras | null | undefined): boolean {
  if (!user) return false;
  if (isRcInternalOperator(user.role)) return true;

  if (!hasActivePaidRelationship(user)) return false;

  const ents = entitlementsFromUser(user);
  if (ents.has("dashboard_access")) return true;

  if (dashboardAccessViaLegacyField(user.dashboardAccess)) return true;

  const pid = canonicalMonetizationPlanId(user.planId ?? "");
  if (pid === "rc_lite") {
    return user.customerType?.trim().toLowerCase() === "hybrid";
  }

  const ct = resolveSessionCustomerType(user);
  if (ct === "rc_lite_api") return false;
  if (ct === "hybrid" || ct === "platform_internal") return true;
  if (ct === "rapid_cortex_platform") return true;
  return false;
}

/**
 * Signed-in RC Lite console (oauth clients, usage, API billing) — not dispatcher UX.
 */
export function hasRcLitePortalAccess(user: SessionProductExtras | null | undefined): boolean {
  if (!user) return false;
  if (isRcInternalOperator(user.role)) return true;
  if (!hasActivePaidRelationship(user)) return false;

  const ents = entitlementsFromUser(user);
  if (ents.has("api_portal_access") || ents.has("api_access")) return true;

  const ct = resolveSessionCustomerType(user);
  if (ct === "hybrid") return true;

  const pid = canonicalMonetizationPlanId(user.planId ?? "");
  if (!pid) return false;
  const planFeats = resolveFeatureEntitlements({ planId: pid, addOnIds: [] });
  return planFeats.has("api_portal_access") || planFeats.has("api_access");
}

/** Any recognizable product SKU — used for blocking “no entitlement” dead-ends vs technical errors. */
export function hasAssignedProductSku(user: SessionProductExtras | null | undefined): boolean {
  if (!user) return false;
  if (hasRapidCortexDashboardAccess(user) || hasRcLitePortalAccess(user)) return true;
  return false;
}
