import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  PLATFORM_AGENCY_ID,
  type AccessCheckResult,
  type AgencyNetworkPolicy,
  defaultAgencyNetworkPolicy,
  extractClientIp,
  ipMatchesCidrs,
  isNetworkExemptRole,
  isPrivateIp,
  isWithinAccessWindow,
  maskIpForLogging,
  nextAccessWindowOpens,
  type UserContext,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { NetworkEmergencyOverrideRepository } from "../repositories/networkEmergencyOverrideRepository.js";
import { makeId } from "../lib/ids.js";
import { jsonStatus } from "../lib/response.js";

const agencyRepo = new AgencyRepository();
const auditRepo = new AuditRepository();
const overrideRepo = new NetworkEmergencyOverrideRepository();

const CACHE_TTL_MS = 30_000;
const policyCache = new Map<string, { policy: AgencyNetworkPolicy; fetchedAt: number }>();

const NETWORK_DENY_KEY = "__networkDenyResponse";

type NetworkTaggedEvent = APIGatewayProxyEventV2 & {
  [NETWORK_DENY_KEY]?: APIGatewayProxyResultV2;
};

const SKIP_PATH_PREFIXES = [
  "/api/auth/",
  "/api/health",
  "/api/billing/webhooks",
  "/api/rc-lite/webhooks",
  "/api/agency/emergency-override-request",
];

function shouldSkipNetworkCheck(event: APIGatewayProxyEventV2): boolean {
  const path = event.rawPath ?? "";
  if (event.requestContext.http.method === "OPTIONS") return true;
  return SKIP_PATH_PREFIXES.some((p) => path.startsWith(p));
}

function getCachedPolicy(agencyId: string): AgencyNetworkPolicy | null {
  const hit = policyCache.get(agencyId);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > CACHE_TTL_MS) {
    policyCache.delete(agencyId);
    return null;
  }
  return hit.policy;
}

async function loadPolicy(agencyId: string): Promise<AgencyNetworkPolicy> {
  const cached = getCachedPolicy(agencyId);
  if (cached) return cached;
  const agency = await agencyRepo.get(agencyId);
  const policy = agency?.networkPolicy ?? defaultAgencyNetworkPolicy();
  policyCache.set(agencyId, { policy, fetchedAt: Date.now() });
  return policy;
}

function denyResponse(result: AccessCheckResult): APIGatewayProxyResultV2 {
  const slim: AccessCheckResult = {
    allowed: false,
    blockedBy: result.blockedBy,
    retryAfter: result.retryAfter,
    message:
      result.blockedBy === "ip_allowlist"
        ? "Access is restricted to authorized network locations. Contact your agency IT administrator."
        : "Access is only available during authorized shift hours.",
  };
  return jsonStatus(
    {
      error: "NETWORK_ACCESS_DENIED",
      data: slim,
    },
    403,
  );
}

export function getNetworkDenialFromEvent(
  event: APIGatewayProxyEventV2,
): APIGatewayProxyResultV2 | undefined {
  return (event as NetworkTaggedEvent)[NETWORK_DENY_KEY];
}

export function attachNetworkDenialToEvent(
  event: APIGatewayProxyEventV2,
  response: APIGatewayProxyResultV2,
): void {
  (event as NetworkTaggedEvent)[NETWORK_DENY_KEY] = response;
}

async function computeNetworkAccess(
  event: APIGatewayProxyEventV2,
  user: UserContext,
  options: { auditDenials: boolean; consumeEmergencyOverride: boolean },
): Promise<AccessCheckResult> {
  if (shouldSkipNetworkCheck(event)) return { allowed: true };
  if (isNetworkExemptRole(user.role)) return { allowed: true };
  if (user.agencyId === PLATFORM_AGENCY_ID) return { allowed: true };

  const policy = await loadPolicy(user.agencyId);
  const clientIp = extractClientIp(event);
  const maskedIp = maskIpForLogging(clientIp);

  if (policy.ipAllowlistEnabled) {
    const cidrs = policy.allowedCidrs.map((c) => c.cidr);
    const allowed =
      (process.env.NETWORK_ALLOW_PRIVATE_IPS === "true" && isPrivateIp(clientIp)) ||
      ipMatchesCidrs(clientIp, cidrs);
    if (!allowed) {
      if (options.auditDenials) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.NETWORK_ACCESS_DENIED_IP,
          details: { maskedIp, role: user.role, blockedBy: "ip_allowlist" },
          createdAt: new Date().toISOString(),
          resourceType: "network_policy",
          resourceId: user.agencyId,
        });
      }
      return {
        allowed: false,
        blockedBy: "ip_allowlist",
        message:
          "Access is restricted to authorized network locations. Contact your agency IT administrator.",
        maskedClientIp: maskedIp,
      };
    }
  }

  if (policy.timeRestrictionEnabled && policy.shiftSchedule) {
    const token = await overrideRepo.findValidToken(user.userId, user.agencyId);
    if (token) {
      if (options.consumeEmergencyOverride) {
        await overrideRepo.markUsed(token.userId, token.sortKey);
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.NETWORK_EMERGENCY_OVERRIDE_USED,
          details: { tokenId: token.tokenId, maskedIp },
          createdAt: new Date().toISOString(),
          resourceType: "network_emergency_override",
          resourceId: token.tokenId,
        });
      }
      return { allowed: true };
    }

    if (!isWithinAccessWindow(policy.shiftSchedule)) {
      const retryAfter = nextAccessWindowOpens(policy.shiftSchedule);
      const tz = policy.shiftSchedule.timezone;
      if (options.auditDenials) {
        await auditRepo.create({
          eventId: makeId("audit"),
          agencyId: user.agencyId,
          actorId: user.userId,
          type: AUDIT_EVENT_TYPES.NETWORK_ACCESS_DENIED_TIME,
          details: { maskedIp, role: user.role, blockedBy: "time_restriction", retryAfter },
          createdAt: new Date().toISOString(),
          resourceType: "network_policy",
          resourceId: user.agencyId,
        });
      }
      return {
        allowed: false,
        blockedBy: "time_restriction",
        message:
          "Access is only available during authorized shift hours. Contact your agency IT administrator for schedule questions.",
        retryAfter: retryAfter ?? undefined,
        shiftTimezone: tz,
        allowEmergencyOverride: policy.allowEmergencyOverride,
      };
    }
  }

  return { allowed: true };
}

/** Preflight / diagnostics — no Dynamo audit writes, does not consume emergency tokens. */
export async function evaluateNetworkAccess(
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<AccessCheckResult> {
  return computeNetworkAccess(event, user, {
    auditDenials: false,
    consumeEmergencyOverride: false,
  });
}

export async function networkAccessMiddleware(
  event: APIGatewayProxyEventV2,
  user: UserContext,
): Promise<{ allowed: true } | { allowed: false; response: APIGatewayProxyResultV2 }> {
  const result = await computeNetworkAccess(event, user, {
    auditDenials: true,
    consumeEmergencyOverride: true,
  });
  if (result.allowed) return { allowed: true };
  const response = denyResponse(result);
  attachNetworkDenialToEvent(event, response);
  return { allowed: false, response };
}
