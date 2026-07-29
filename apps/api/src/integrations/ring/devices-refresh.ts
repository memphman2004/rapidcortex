import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  isRingEnabled,
  RingDeviceService,
  RingOAuthService,
  RingTokenExpiredError,
  RingTokenStore,
} from "../../lib/ring-integration.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";

const accounts = new RingAccountRepository();
const tokenStore = new RingTokenStore();
const oauth = new RingOAuthService();
const deviceService = new RingDeviceService();

function configureRingTables(): void {
  if (env.ringAccountsTable) {
    process.env.RING_TABLE_ACCOUNTS = env.ringAccountsTable;
  }
  if (env.ringDevicesTable) {
    process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingTables();

    const user = await getUserContext(event);
    if (!user) return ringJson({ success: false, error: "Unauthorized" }, 401);
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }
    if (!isRingEnabled()) {
      return ringJson({ success: false, error: "Ring integration is not enabled." }, 403);
    }

    const account = await accounts.getLinkedAccount(user.agencyId, user.userId);
    if (!account) {
      return ringJson(
        { success: false, error: "No linked Ring account. Connect your Ring account first." },
        404,
      );
    }
    if (account.connectionStatus !== "CONNECTED") {
      return ringJson({ success: false, error: "Ring account needs to be reconnected." }, 400);
    }

    let accessToken: string;
    try {
      const current = await tokenStore.getTokens(account.secretsManagerTokenKey);
      accessToken =
        current.expiresAt <= Date.now()
          ? (await oauth.refreshTokens(account.secretsManagerTokenKey)).accessToken
          : current.accessToken;
    } catch (err) {
      if (err instanceof RingTokenExpiredError) {
        await accounts.updateConnectionStatus(user.agencyId, user.userId, "ERROR", {
          updatedAt: new Date().toISOString(),
        });
        return ringJson({ success: false, error: "Ring account needs to be reconnected." }, 400);
      }
      throw err;
    }

    let fallbackLatitude: number | null = null;
    let fallbackLongitude: number | null = null;
    try {
      const body = JSON.parse(event.body ?? "{}") as {
        fallbackLatitude?: unknown;
        fallbackLongitude?: unknown;
      };
      if (typeof body.fallbackLatitude === "number" && Number.isFinite(body.fallbackLatitude)) {
        fallbackLatitude = body.fallbackLatitude;
      }
      if (typeof body.fallbackLongitude === "number" && Number.isFinite(body.fallbackLongitude)) {
        fallbackLongitude = body.fallbackLongitude;
      }
    } catch {
      /* empty / non-JSON body is fine */
    }

    const devices = await deviceService.discoverAndSaveDevices(
      user.agencyId,
      user.userId,
      account.ringAccountId,
      accessToken,
      { fallbackLatitude, fallbackLongitude },
    );

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_DEVICES_REFRESHED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { deviceCount: devices.length },
    });

    return ringJson({ success: true, data: { deviceCount: devices.length } });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_devices_refresh_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to refresh Ring devices." }, 500);
  }
};
