/**
 * POST /api/public/ring/homeowner/delete-account
 * Account Link URL self-serve deletion (email). Homeowners have no dashboard session.
 *
 * Body schema mirrors `packages/shared` `ringHomeownerDeleteAccountBodySchema` (inlined so this
 * Lambda builds when vendor `node_modules` on the external volume is mid-repair).
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { isRingEnabled } from "../../lib/ring-integration.js";
import { deleteHomeownerAccount } from "./homeowner-account-delete.js";
import { resolveHomeownerForDeletion } from "./homeowner-cognito.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";
import { ringPublicClientIp, ringPublicJson } from "./ring-public-cors.js";

const deleteAccountBodySchema = z.object({
  email: z.string().email().max(320),
});

const GENERIC_DONE_MESSAGE =
  "If a Rapid Cortex device-owner account exists for this email, it has been deleted.";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return ringPublicJson(event, 204, "");
  }

  try {
    if (!isRingEnabled()) {
      return ringPublicJson(event, 503, { success: false, error: "Ring Connect is not enabled." });
    }

    const allowed = await consumeRingPublicOAuthRateSlot(ringPublicClientIp(event));
    if (!allowed) {
      return ringPublicJson(event, 429, { success: false, error: "Too many requests." });
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return ringPublicJson(event, 400, { success: false, error: "Invalid JSON body." });
    }

    const parsed = deleteAccountBodySchema.safeParse(body);
    if (!parsed.success) {
      return ringPublicJson(event, 400, { success: false, error: "Enter a valid email address." });
    }

    let identity: { userId: string; email: string; agencyId: string } | null;
    try {
      identity = await resolveHomeownerForDeletion(parsed.data.email);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "COGNITO_NOT_CONFIGURED") {
        return ringPublicJson(event, 503, {
          success: false,
          error: "Authentication is not configured.",
        });
      }
      console.error(JSON.stringify({ msg: "ring_homeowner_delete_lookup_error", error: msg }));
      return ringPublicJson(event, 500, { success: false, error: "Unable to delete account." });
    }

    if (!identity) {
      return ringPublicJson(event, 200, { success: true, data: { message: GENERIC_DONE_MESSAGE } });
    }

    await deleteHomeownerAccount({
      userId: identity.userId,
      email: identity.email,
      agencyId: identity.agencyId,
    });

    return ringPublicJson(event, 200, { success: true, data: { message: "Account deleted." } });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_homeowner_delete_account_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringPublicJson(event, 500, { success: false, error: "Unable to delete account." });
  }
};
