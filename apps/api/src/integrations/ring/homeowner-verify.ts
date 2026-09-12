/**
 * RING INTEGRATION — SUSPENDED
 * Ring camera integration is currently inactive pending Ring developer
 * program approval. All handlers return 503. Do not remove this code.
 * To reactivate: set RING_INTEGRATION_ENABLED = true in feature-flags.ts
 * and remove all RING_DISABLED guards added on 2026-09-11.
 */

import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ringHomeownerVerifyQuerySchema } from "rapid-cortex-shared";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { configureRingEmergencyTables } from "./ring-tables.js";
import { ringPublicCorsHeaders, ringPublicJson } from "./ring-public-cors.js";
import {
  consumeHomeownerVerificationToken,
  enableVerifiedHomeowner,
  homeownerSignInUrl,
} from "./homeowner-email-verify.js";
import { RING_INTEGRATION_ENABLED, ringIntegrationDisabledResponse } from "./ring-api-response.js";

function htmlPage(title: string, body: string, statusCode: number) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${title}</title></head><body><p>${body}</p></body></html>`,
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // RING_DISABLED — integration suspended pending Ring developer program approval
  if (!RING_INTEGRATION_ENABLED) {
    return ringIntegrationDisabledResponse(event);
  }
  configureRingEmergencyTables();

  if (event.requestContext?.http?.method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: ringPublicCorsHeaders(event, "GET,OPTIONS"),
      body: "",
    };
  }

  const parsed = ringHomeownerVerifyQuerySchema.safeParse(event.queryStringParameters ?? {});
  if (!parsed.success) {
    return ringPublicJson(event, 403, { error: "Forbidden" }, "GET,OPTIONS");
  }

  try {
    const pending = await consumeHomeownerVerificationToken(parsed.data.token);
    if (!pending) {
      return ringPublicJson(event, 403, { error: "Forbidden" }, "GET,OPTIONS");
    }
    await enableVerifiedHomeowner(pending.cognitoUsername);
    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_HOMEOWNER_EMAIL_VERIFIED,
      agencyId: pending.agencyId,
      actorId: pending.cognitoUsername,
      details: { email: pending.email },
    });
    const signIn = homeownerSignInUrl();
    if ((event.headers?.accept || event.headers?.Accept || "").includes("application/json")) {
      return ringPublicJson(event, 200, { success: true, signIn }, "GET,OPTIONS");
    }
    return htmlPage(
      "Email verified",
      `Your Rapid Cortex device-owner account is verified. You can <a href="${signIn}">sign in</a>.`,
      200,
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_homeowner_verify_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringPublicJson(event, 500, { error: "Unable to verify account." }, "GET,OPTIONS");
  }
};
