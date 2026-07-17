/**
 * Public Ring homeowner password reset (ForgotPassword / ConfirmForgotPassword).
 * Used by marketing `/connect/ring/link` — not the agency CSRF-protected web BFF.
 *
 * Body schemas mirror `packages/shared` `ringHomeownerForgotPasswordBodySchema` /
 * `ringHomeownerConfirmForgotPasswordBodySchema` (inlined so this Lambda builds when
 * vendor `node_modules` on the external volume is mid-repair).
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { isRingEnabled } from "../../lib/ring-integration.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";
import { ringPublicClientIp, ringPublicJson } from "./ring-public-cors.js";
import {
  confirmHomeownerPasswordReset,
  requestHomeownerPasswordReset,
} from "./homeowner-cognito.js";

const forgotBodySchema = z.object({
  email: z.string().email().max(320),
});

const confirmBodySchema = z.object({
  email: z.string().email().max(320),
  code: z.string().min(4).max(32),
  newPassword: z.string().min(12).max(256),
});

function rawPath(event: { rawPath?: string; requestContext?: { http?: { path?: string } } }): string {
  return event.rawPath ?? event.requestContext?.http?.path ?? "";
}

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

    const path = rawPath(event);

    if (path.endsWith("/forgot-password")) {
      const parsed = forgotBodySchema.safeParse(body);
      if (!parsed.success) {
        return ringPublicJson(event, 400, { success: false, error: "Valid email is required." });
      }
      try {
        const result = await requestHomeownerPasswordReset(parsed.data.email);
        return ringPublicJson(event, 200, { success: true, message: result.message });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "COGNITO_NOT_CONFIGURED") {
          return ringPublicJson(event, 503, { success: false, error: "Authentication is not configured." });
        }
        console.error(JSON.stringify({ msg: "ring_homeowner_forgot_password_failed", error: msg }));
        return ringPublicJson(event, 200, {
          success: true,
          message:
            "If an account exists for this email, we sent a verification code. Check your inbox and spam folder.",
        });
      }
    }

    if (path.endsWith("/confirm-forgot-password")) {
      const parsed = confirmBodySchema.safeParse(body);
      if (!parsed.success) {
        return ringPublicJson(event, 400, {
          success: false,
          error: "email, code, and newPassword are required.",
        });
      }
      try {
        await confirmHomeownerPasswordReset(parsed.data);
        return ringPublicJson(event, 200, {
          success: true,
          message: "Password reset successfully. Sign in with your new password to finish linking.",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "COGNITO_NOT_CONFIGURED") {
          return ringPublicJson(event, 503, { success: false, error: "Authentication is not configured." });
        }
        if (msg === "PASSWORD_POLICY") {
          return ringPublicJson(event, 400, {
            success: false,
            error:
              "Password must be at least 12 characters with uppercase, lowercase, a number, and a symbol.",
          });
        }
        return ringPublicJson(event, 400, {
          success: false,
          error: "Invalid or expired code, or password does not meet requirements.",
        });
      }
    }

    return ringPublicJson(event, 404, { success: false, error: "Not found." });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_homeowner_password_reset_unhandled",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringPublicJson(event, 500, { success: false, error: "Unable to reset password." });
  }
};
