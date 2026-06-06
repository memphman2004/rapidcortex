import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";
import { AuditRepository } from "../repositories/auditRepository.js";
import { getVerifiedJwtClaims } from "../lib/auth.js";
import { makeId } from "../lib/ids.js";
import { jsonStatus } from "../lib/response.js";

type LambdaMiddleware = (
  event: APIGatewayProxyEventV2,
  user: UserContext,
) => Promise<APIGatewayProxyResultV2 | null>;

const TIER_SUFFIXES = new Set([
  "tier1",
  "tier2",
  "tier3",
  "tier4",
  "basic",
  "standard",
  "premium",
  "advanced",
  "full",
  "small",
  "medium",
  "large",
]);

const FAMILY_ALIASES: Record<string, string[]> = {
  "caller_media.photo.": ["caller_media.photo.", "media.photo."],
  "caller_media.video.": ["caller_media.video.", "media.video."],
  "caller_media.live_stream.": ["caller_media.live_stream.", "media.livestream."],
  "caller_media.sms_link": ["caller_media.sms_link", "media.", "media.photo.", "media.video."],
  "supervisor_qa.": ["supervisor_qa.", "qa."],
  "incident_command.": ["incident_command.", "incident.command."],
};

function normalizeAddonFamily(key: string): string {
  const parts = key.split(".");
  const last = parts[parts.length - 1] ?? "";
  if (parts.length > 2 && TIER_SUFFIXES.has(last)) {
    return parts.slice(0, -1).join(".");
  }
  return key;
}

function parseClaimAddons(raw: unknown): string[] {
  const csv = typeof raw === "string" ? raw : "";
  if (!csv) return [];
  return Array.from(
    new Set(
      csv
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function resolvePrefixes(familyPrefix: string): string[] {
  const normalized = familyPrefix.trim().replace(/\*+$/, "");
  if (!normalized) return [];

  // Handles values like "hospital.routing or hospital.*"
  if (normalized.includes(" or ")) {
    return normalized
      .split(/\s+or\s+/i)
      .map((part) => part.trim().replace(/\*+$/, ""))
      .filter(Boolean);
  }
  return FAMILY_ALIASES[normalized] ?? [normalized];
}

function hasFamilyMatch(enabledAddons: string[], familyPrefix: string): boolean {
  const prefixes = resolvePrefixes(familyPrefix);
  if (prefixes.length === 0) return false;

  const candidates = enabledAddons.flatMap((addon) => {
    const family = normalizeAddonFamily(addon);
    return family === addon ? [addon] : [addon, family];
  });
  return candidates.some((candidate) => prefixes.some((prefix) => candidate.startsWith(prefix)));
}

async function writeAddonRejectionAudit(
  event: APIGatewayProxyEventV2,
  user: UserContext,
  familyPrefix: string,
): Promise<void> {
  const ip = (event.requestContext as { http?: { sourceIp?: string } }).http?.sourceIp;
  const userAgent = event.headers?.["user-agent"] ?? event.headers?.["User-Agent"];
  const routeKey = event.routeKey ?? "";
  const method = event.requestContext.http?.method ?? "UNKNOWN";
  const rawPath = event.rawPath ?? "";

  const repo = new AuditRepository();
  await repo.create({
    eventId: makeId("audit"),
    agencyId: user.agencyId,
    actorId: user.userId,
    type: "auth.addon_denied",
    details: {
      family: familyPrefix,
      method,
      routeKey,
      path: rawPath,
      actorRole: user.role,
    },
    createdAt: new Date().toISOString(),
    resourceType: "agency",
    resourceId: user.agencyId,
    ip,
    userAgent,
  });
}

/**
 * Checks whether the tenant has ANY enabled add-on whose key starts with familyPrefix.
 * Reads enabled keys from verified JWT claim `custom:addons`.
 */
export function requireAddon(familyPrefix: string): LambdaMiddleware {
  return async (event, user) => {
    const claims = await getVerifiedJwtClaims(event);
    const enabledAddons = parseClaimAddons(claims?.["custom:addons"]);
    if (hasFamilyMatch(enabledAddons, familyPrefix)) return null;

    try {
      await writeAddonRejectionAudit(event, user, familyPrefix);
    } catch {
      // Do not mask 403 with audit write errors.
    }
    return jsonStatus({ error: "addon_not_enabled", family: familyPrefix }, 403);
  };
}

