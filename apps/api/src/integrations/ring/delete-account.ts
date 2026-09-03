/**
 * DELETE /api/user/account
 * Permanently deletes the authenticated Ring Device Owner Cognito account and
 * revokes linked Ring OAuth tokens. Required for Ring developer certification.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  isRingEnabled,
  RingDeviceService,
  RingTokenStore,
} from "../../lib/ring-integration.js";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringJson } from "./ring-api-response.js";

const cognito = new CognitoIdentityProviderClient({
  region: env.region || process.env.AWS_REGION || "us-east-1",
});
const accounts = new RingAccountRepository();
const tokenStore = new RingTokenStore();
const deviceService = new RingDeviceService();

function configureRingTables(): void {
  if (env.ringAccountsTable) {
    process.env.RING_TABLE_ACCOUNTS = env.ringAccountsTable;
  }
  if (env.ringDevicesTable) {
    process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  }
}

async function resolveCognitoUsername(userPoolId: string, userId: string, email: string): Promise<string> {
  const candidates = [...new Set([userId, email].map((v) => v.trim()).filter(Boolean))];
  for (const username of candidates) {
    try {
      const out = await cognito.send(
        new AdminGetUserCommand({ UserPoolId: userPoolId, Username: username }),
      );
      return out.Username ?? username;
    } catch (err) {
      if (err instanceof UserNotFoundException) continue;
      const name = err instanceof Error ? err.name : "";
      if (name === "UserNotFoundException") continue;
      throw err;
    }
  }
  throw new Error("COGNITO_USER_NOT_FOUND");
}

async function revokeRingLinkage(agencyId: string, userId: string): Promise<void> {
  const linked = await accounts.getLinkedAccount(agencyId, userId);
  if (linked?.secretsManagerTokenKey) {
    try {
      await tokenStore.deleteTokens(linked.secretsManagerTokenKey);
    } catch (ringErr) {
      console.error(
        JSON.stringify({
          msg: "delete_account_ring_token_cleanup_failed",
          agencyId,
          error: ringErr instanceof Error ? ringErr.message : String(ringErr),
        }),
      );
    }
  }

  try {
    await deviceService.deleteLinkedDevices(agencyId, userId);
  } catch (devErr) {
    console.error(
      JSON.stringify({
        msg: "delete_account_ring_device_cleanup_failed",
        agencyId,
        error: devErr instanceof Error ? devErr.message : String(devErr),
      }),
    );
  }

  try {
    await accounts.deleteOAuthState(agencyId, userId);
  } catch {
    // OAuth state row is optional.
  }

  if (linked) {
    try {
      await accounts.deleteLinkedAccount(agencyId, userId);
    } catch (accErr) {
      console.error(
        JSON.stringify({
          msg: "delete_account_ring_account_row_cleanup_failed",
          agencyId,
          error: accErr instanceof Error ? accErr.message : String(accErr),
        }),
      );
    }
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingTables();

    const user = await getUserContext(event);
    if (!user) {
      return ringJson({ success: false, error: "Unauthorized" }, 401);
    }
    if (!isUserAccountActive(user)) {
      return ringJson({ success: false, error: ACCOUNT_INACTIVE_MESSAGE }, 403);
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) {
      return ringJson({ success: false, error: "Password update is required before continuing." }, 403);
    }

    // In-app deletion is the Ring Device Owner (homeowner) self-service path.
    // Agency operator accounts are provisioned/deprovisioned by admins.
    if (String(user.role).trim().toLowerCase() !== "homeowner") {
      return ringJson(
        { success: false, error: "Only Ring Device Owner accounts can be deleted in-app." },
        403,
      );
    }

    const userPoolId = env.cognitoUserPoolId;
    if (!userPoolId) {
      return ringJson({ success: false, error: "Server configuration error." }, 500);
    }

    const username = await resolveCognitoUsername(userPoolId, user.userId, user.email);

    await cognito.send(
      new AdminDisableUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      }),
    );

    if (isRingEnabled()) {
      await revokeRingLinkage(user.agencyId, user.userId);
    }

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_USER_ACCOUNT_DELETED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { reason: "user_requested_account_deletion" },
    });
    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_ACCOUNT_UNLINKED,
      agencyId: user.agencyId,
      actorId: user.userId,
      details: { reason: "user_requested_account_deletion" },
    });

    await cognito.send(
      new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      }),
    );

    return ringJson({ success: true, data: { message: "Account deleted." } }, 200);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "delete_account_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: "Unable to delete account." }, 500);
  }
};
