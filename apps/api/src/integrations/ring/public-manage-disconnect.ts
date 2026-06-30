import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isRingEnabled, RingTokenStore } from "../../lib/ring-integration.js";
import { RingCitizenOwnerRepository } from "../../repositories/ringCitizenOwnerRepository.js";
import { RingPublicOAuthStateRepository } from "../../repositories/ringPublicOAuthStateRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";
import { ringJson } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const tokenStore = new RingTokenStore();
const owners = new RingCitizenOwnerRepository();
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

    let body: { token?: unknown };
    try {
      body = event.body ? (JSON.parse(event.body) as { token?: unknown }) : {};
    } catch {
      return ringJson({ success: false, error: "Invalid JSON body." }, 400);
    }

    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
      return ringJson({ success: false, error: "Missing manage token." }, 400);
    }

    // Consume the single-use manage token — proof of possession from completed OAuth round trip.
    const manageRecord = await oauthStates.takeManageToken(token);
    if (!manageRecord) {
      return ringJson({ success: false, error: "Invalid or expired manage token." }, 401);
    }

    const { ringAccountId, agencyId } = manageRecord;

    const owner = await owners.getByRingAccountId(ringAccountId);
    if (!owner) {
      return ringJson({ success: false, error: "No connection found for this Ring account." }, 404);
    }

    // Best-effort Secrets Manager token revocation before hard-deleting the record.
    if (owner.secretsManagerTokenKey) {
      try {
        await tokenStore.deleteTokens(owner.secretsManagerTokenKey);
      } catch (smErr) {
        console.error(
          JSON.stringify({
            msg: "ring_citizen_disconnect_token_delete_failed",
            agencyId,
            ringAccountId,
            error: smErr instanceof Error ? smErr.message : String(smErr),
          }),
        );
      }
    }

    await owners.delete(ringAccountId);

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CITIZEN_DISCONNECTED,
      agencyId,
      actorId: ringAccountId,
      details: { method: "manage_oauth_reauth" },
      resourceId: ringAccountId,
    });

    return ringJson({ success: true }, 200);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_public_manage_disconnect_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to disconnect Ring account." }, 500);
  }
};
