import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRingEnabled, RingOAuthService } from "../../lib/ring-integration.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { RingPublicOAuthStateRepository } from "../../repositories/ringPublicOAuthStateRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";
import { ringJson, ringRedirect } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const oauth = new RingOAuthService();
const agencies = new AgencyRepository();
const oauthStates = new RingPublicOAuthStateRepository();

function clientIp(event: { requestContext?: { http?: { sourceIp?: string } } }): string {
  return event.requestContext?.http?.sourceIp?.trim() || "unknown";
}

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

    const agencyId = event.queryStringParameters?.agencyId?.trim() ?? "";
    if (!agencyId) {
      return ringJson({ success: false, error: "Invalid request." }, 400);
    }

    const agency = await agencies.get(agencyId);
    if (!agency) {
      return ringJson({ success: false, error: "Invalid request." }, 400);
    }

    const { url, state } = await oauth.buildCitizenAuthorizationUrl(agencyId);
    await oauthStates.saveState(state, agencyId, "manage");

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CITIZEN_MANAGE_INITIATED,
      agencyId,
      actorId: `citizen-manage:${agencyId}`,
      details: {},
    });

    return ringRedirect(url);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_public_manage_start_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to start Ring manage flow." }, 500);
  }
};
