import { randomUUID } from "node:crypto";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRingEnabled, normalizeRingReturnUrl, RingOAuthService } from "../../lib/ring-integration.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";
import { ringJson, ringRedirect } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";
import {
  isUnmatchedHomeownerAgency,
  RING_HOMEOWNER_UNMATCHED_AGENCY_ID,
} from "./ring-homeowner-id.js";

const oauth = new RingOAuthService();
const agencies = new AgencyRepository();
const accounts = new RingAccountRepository();

/** Closed enum of valid US state + DC codes. */
const VALID_STATE_CODES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT",
  "VT","VA","WA","WV","WI","WY",
]);

function clientIp(event: { requestContext?: { http?: { sourceIp?: string } } }): string {
  return event.requestContext?.http?.sourceIp?.trim() || "unknown";
}

/**
 * Public (no RC auth) Ring OAuth start for device owners.
 * Uses RING_REDIRECT_URI (/api/integrations/ring/callback) — already registered with Ring.
 * Homeowner flow is detected in the shared callback via the `hw:` userId prefix.
 *
 * GET /api/public/ring/oauth/start?agencyId={optional}&state={optional US abbr}
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingEmergencyTables();

    if (!isRingEnabled()) {
      return ringJson({ success: false, error: "Ring integration is not enabled." }, 403);
    }

    const allowed = await consumeRingPublicOAuthRateSlot(clientIp(event));
    if (!allowed) {
      return ringJson({ success: false, error: "Too many requests." }, 429);
    }

    const qs = event.queryStringParameters ?? {};
    const agencyIdRaw = qs.agencyId?.trim() ?? "";
    const usStateRaw = qs.state?.trim().toUpperCase() ?? "";
    const usState = usStateRaw && VALID_STATE_CODES.has(usStateRaw) ? usStateRaw : null;

    let agencyId = agencyIdRaw;
    if (!agencyId) {
      agencyId = RING_HOMEOWNER_UNMATCHED_AGENCY_ID;
    } else if (!isUnmatchedHomeownerAgency(agencyId)) {
      const agency = await agencies.get(agencyId);
      if (!agency) {
        return ringJson({ success: false, error: "Invalid request." }, 400);
      }
    }

    const rawReturnUrl = qs.ring_return_url ?? qs.return_url ?? qs.app_redirect_url ?? null;
    const ringReturnUrl = normalizeRingReturnUrl(rawReturnUrl);
    let rawScheme: string | null = null;
    if (rawReturnUrl?.trim()) {
      try {
        rawScheme = new URL(rawReturnUrl.trim()).protocol;
      } catch {
        rawScheme = "unparseable";
      }
    }
    console.info(
      JSON.stringify({
        msg: "ring_public_oauth_return_url",
        rawReturnUrl,
        rawScheme,
        normalizedReturnUrl: ringReturnUrl,
        accepted: Boolean(ringReturnUrl),
        ringEnabled: isRingEnabled(),
      }),
    );
    const homeownerId = `hw:${randomUUID()}`;

    const { url, state } = await oauth.buildAuthorizationUrl(
      agencyId,
      homeownerId,
      ringReturnUrl,
      usState,
    );
    await accounts.saveOAuthState(agencyId, homeownerId, state, 600);

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CITIZEN_OAUTH_INITIATED,
      agencyId,
      actorId: homeownerId,
      details: {
        participantType: "homeowner",
        unmatched: isUnmatchedHomeownerAgency(agencyId),
        ...(usState ? { usState } : {}),
      },
    });

    return ringRedirect(url);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_public_oauth_start_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to start Ring authorization." }, 500);
  }
};
