import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { RingOAuthService, RingTokenExpiredError } from "../../lib/ring-integration.js";
import { env } from "../../lib/env.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";

const bodySchema = z.object({
  agencyId: z.string().min(1),
  userId: z.string().min(1),
});

const oauth = new RingOAuthService();
const accounts = new RingAccountRepository();

function headerValue(event: { headers?: Record<string, string | undefined> }, name: string): string {
  const lower = name.toLowerCase();
  const headers = event.headers ?? {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && value) return value;
  }
  return "";
}

function internalKeyMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function configureRingTables(): void {
  if (env.ringAccountsTable) {
    process.env.RING_TABLE_ACCOUNTS = env.ringAccountsTable;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingTables();

    const expectedKey = env.internalServiceKey;
    if (!expectedKey) {
      return ringJson({ success: false, error: "Unauthorized" }, 401);
    }

    const providedKey = headerValue(event, "X-Internal-Service-Key");
    if (!providedKey || !internalKeyMatches(providedKey, expectedKey)) {
      return ringJson({ success: false, error: "Unauthorized" }, 401);
    }

    let parsed: z.infer<typeof bodySchema>;
    try {
      parsed = bodySchema.parse(JSON.parse(event.body ?? "{}"));
    } catch {
      return ringJson({ success: false, error: "agencyId and userId are required." }, 400);
    }

    const account = await accounts.getLinkedAccount(parsed.agencyId, parsed.userId);
    if (!account) {
      return ringJson({ success: false, error: "Ring account not found." }, 404);
    }
    if (account.connectionStatus !== "CONNECTED") {
      return ringJson({ success: false, error: "Ring account is not connected." }, 400);
    }

    const now = new Date().toISOString();

    try {
      await oauth.refreshTokens(account.secretsManagerTokenKey);
      await accounts.updateConnectionStatus(parsed.agencyId, parsed.userId, "CONNECTED", {
        lastTokenRefreshAt: now,
        updatedAt: now,
      });
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_TOKEN_REFRESHED,
        agencyId: parsed.agencyId,
        actorId: parsed.userId,
        details: {},
      });
      return ringJson({ success: true });
    } catch (err) {
      if (err instanceof RingTokenExpiredError) {
        await accounts.updateConnectionStatus(parsed.agencyId, parsed.userId, "ERROR", {
          updatedAt: now,
        });
        await auditRingEvent({
          type: AUDIT_EVENT_TYPES.RING_TOKEN_REFRESH_FAILED,
          agencyId: parsed.agencyId,
          actorId: parsed.userId,
          details: { reason: "refresh_token_expired" },
        });
        return ringJson({ success: true });
      }

      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_TOKEN_REFRESH_FAILED,
        agencyId: parsed.agencyId,
        actorId: parsed.userId,
        details: { reason: "refresh_failed" },
      });
      console.error(
        JSON.stringify({
          msg: "ring_refresh_token_error",
          agencyId: parsed.agencyId,
          userId: parsed.userId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return ringJson({ success: false, error: "Unable to refresh Ring token." }, 500);
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_refresh_token_unexpected",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to refresh Ring token." }, 500);
  }
};
