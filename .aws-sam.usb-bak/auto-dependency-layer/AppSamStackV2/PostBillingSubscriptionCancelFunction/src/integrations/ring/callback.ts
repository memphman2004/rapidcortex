import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  decodeRingOAuthState,
  RingAuthError,
  RingDeviceService,
  RingOAuthService,
  RingTokenStore,
  RING_ACCOUNT_LINK_URL,
} from "../../lib/ring-integration.js";
import type { LinkedRingAccount } from "../../lib/ring-integration.js";
import { env } from "../../lib/env.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringRedirect } from "./ring-api-response.js";

const oauth = new RingOAuthService();
const tokenStore = new RingTokenStore();
const accounts = new RingAccountRepository();

function linkUrl(status: "success" | "error"): string {
  const base = (process.env.RING_ACCOUNT_LINK_URL?.trim() || RING_ACCOUNT_LINK_URL).replace(/\/$/, "");
  return `${base}?status=${status}`;
}

function configureRingTables(): void {
  if (env.ringAccountsTable) {
    process.env.RING_TABLE_ACCOUNTS = env.ringAccountsTable;
  }
  if (env.ringDevicesTable) {
    process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  configureRingTables();

  const code = event.queryStringParameters?.code?.trim() ?? "";
  const incomingState = event.queryStringParameters?.state?.trim() ?? "";

  let agencyId = "";
  let userId = "";

  const finish = async (status: "success" | "error") => {
    if (agencyId && userId) {
      try {
        await accounts.deleteOAuthState(agencyId, userId);
      } catch (cleanupErr) {
        console.error(
          JSON.stringify({
            msg: "ring_oauth_state_cleanup_failed",
            agencyId,
            userId,
            error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          }),
        );
      }
    }
    return ringRedirect(linkUrl(status));
  };

  if (!code || !incomingState) {
    return finish("error");
  }

  try {
    const parsed = decodeRingOAuthState(incomingState);
    agencyId = parsed.agencyId;
    userId = parsed.userId;
  } catch {
    return finish("error");
  }

  const storedState = await accounts.getOAuthState(agencyId, userId);
  if (!storedState) {
    return finish("error");
  }

  try {
    const tokens = await oauth.exchangeCode(code, incomingState, storedState);
    const secretKey = await tokenStore.storeTokens(agencyId, userId, tokens);
    const now = new Date().toISOString();
    const ringAccountId = `ring:${agencyId}:${userId}`;
    const scopes = tokens.scope.split(/\s+/).filter(Boolean);

    const existing = await accounts.getLinkedAccount(agencyId, userId);
    const account: LinkedRingAccount = {
      agencyId,
      userId,
      ringAccountId,
      connectionStatus: "CONNECTED",
      scopes,
      secretsManagerTokenKey: secretKey,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastTokenRefreshAt: now,
    };
    await accounts.upsertLinkedAccount(account);

    let deviceCount = 0;
    try {
      const deviceService = new RingDeviceService();
      const devices = await deviceService.discoverAndSaveDevices(
        agencyId,
        userId,
        ringAccountId,
        tokens.accessToken,
      );
      deviceCount = devices.length;
    } catch (discoveryErr) {
      console.error(
        JSON.stringify({
          msg: "ring_device_discovery_failed",
          agencyId,
          userId,
          error: discoveryErr instanceof Error ? discoveryErr.message : String(discoveryErr),
        }),
      );
    }

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_ACCOUNT_LINKED,
      agencyId,
      actorId: userId,
      details: { deviceCount },
    });

    return finish("success");
  } catch (err) {
    if (err instanceof RingAuthError && err.message.toLowerCase().includes("state mismatch")) {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_OAUTH_STATE_MISMATCH,
        agencyId,
        actorId: userId,
        details: {},
      });
    } else {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_TOKEN_EXCHANGE_FAILED,
        agencyId,
        actorId: userId,
        details: { reason: "token_exchange_failed" },
      });
    }
    console.error(
      JSON.stringify({
        msg: "ring_callback_error",
        agencyId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return finish("error");
  }
};
