import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { PLATFORM_AGENCY_ID, isRcInternalOperator } from "rapid-cortex-shared";

function headerValue(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const headers = event.headers ?? {};
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/** Optional tenant override from query (preferred) or `x-rc-agency-id`. */
export function requestedCallAssistAgencyId(event: APIGatewayProxyEventV2): string | undefined {
  const q = event.queryStringParameters?.agencyId;
  if (typeof q === "string" && q.trim()) return q.trim();
  return headerValue(event, "x-rc-agency-id");
}

/**
 * Tenant for Call Assist reads/writes.
 *
 * RC operators may pass `?agencyId=` to re-scope the dashboard.
 * Customer roles may not request a different tenant — that is 403, not silent ignore.
 */
export function resolveCallAssistTenantAgencyId(
  user: { role: string; agencyId: string },
  requested: string | null | undefined,
): string {
  const raw = String(requested ?? "").trim();
  if (!isRcInternalOperator(user.role)) return user.agencyId;
  if (!raw || raw === PLATFORM_AGENCY_ID) return user.agencyId;
  return raw;
}

/** True when a non-RC caller tried to query another tenant. */
export function callAssistAgencyQueryForbidden(
  user: { role: string; agencyId: string },
  requested: string | null | undefined,
): boolean {
  const raw = String(requested ?? "").trim();
  if (!raw || raw === PLATFORM_AGENCY_ID) return false;
  if (isRcInternalOperator(user.role)) return false;
  return raw !== user.agencyId;
}

export function isPlatformCallAssistTenant(agencyId: string): boolean {
  return agencyId === PLATFORM_AGENCY_ID;
}
