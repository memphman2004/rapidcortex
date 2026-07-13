import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  RingApiClient,
  RingAuthError,
  RingOAuthService,
  RingUnclaimedTokenService,
  isRingEnabled,
} from "../../lib/ring-integration.js";
import { configureRingEmergencyTables } from "./ring-tables.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";
import { ringPublicClientIp, ringPublicJson } from "./ring-public-cors.js";

function extractAuthorizationCode(event: {
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
}): string {
  if (!event.body) return "";
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  const contentType = (
    event.headers?.["content-type"] ||
    event.headers?.["Content-Type"] ||
    ""
  ).toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return String(parsed.code ?? parsed.authorization_code ?? "").trim();
    } catch {
      return "";
    }
  }

  const params = new URLSearchParams(raw);
  return (params.get("code") || params.get("authorization_code") || "").trim();
}

/**
 * Ring Appstore Token Exchange URL.
 * Ring POSTs an authorization code; we exchange within ~60s and store as unclaimed.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  configureRingEmergencyTables();

  if (event.requestContext?.http?.method === "OPTIONS") {
    return ringPublicJson(event, 204, "");
  }

  try {
    if (!isRingEnabled()) {
      return ringPublicJson(event, 503, { status: "error", error: "Ring Connect is not enabled." });
    }

    const allowed = await consumeRingPublicOAuthRateSlot(ringPublicClientIp(event));
    if (!allowed) {
      return ringPublicJson(event, 429, { status: "error", error: "Too many requests." });
    }

    const code = extractAuthorizationCode(event);
    if (!code) {
      return ringPublicJson(event, 400, { status: "error", error: "missing code" });
    }

    const oauth = new RingOAuthService();
    let tokens;
    try {
      tokens = await oauth.exchangeAppstoreCode(code);
    } catch (err) {
      const message = err instanceof RingAuthError ? err.message : "token exchange failed";
      console.error(JSON.stringify({ msg: "ring_appstore_token_exchange_failed", error: message }));
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_TOKEN_EXCHANGE_FAILED,
        agencyId: "public",
        actorId: "ring-appstore",
        details: { flow: "appstore_token_exchange" },
      });
      return ringPublicJson(event, 502, { status: "error", error: message });
    }

    const profile = await new RingApiClient(tokens.accessToken).getPartnerUserProfile();
    const accountId = profile.accountId;
    const unclaimed = new RingUnclaimedTokenService();
    await unclaimed.storeUnclaimed(accountId, tokens);

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_APPSTORE_TOKEN_EXCHANGED,
      agencyId: "public",
      actorId: accountId,
      details: { ringAccountId: accountId, flow: "appstore_token_exchange" },
      resourceId: accountId,
    });

    return ringPublicJson(event, 200, { status: "ok" });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_appstore_token_exchange_error",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
    return ringPublicJson(event, 500, { status: "error", error: "Internal error." });
  }
};
