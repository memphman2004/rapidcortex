/**
 * Shared Ring Device Owner deletion: disable Cognito, revoke Ring tokens/devices, delete user.
 * Used by JWT DELETE /api/user/account and public Account Link POST /homeowner/delete-account.
 */
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
import { env } from "../../lib/env.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import { RingCitizenOwnerRepository } from "../../repositories/ringCitizenOwnerRepository.js";
import { RingHomeownerParticipantRepository } from "../../repositories/ringHomeownerParticipantRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const cognito = new CognitoIdentityProviderClient({
  region: env.region || process.env.AWS_REGION || "us-east-1",
});
const accounts = new RingAccountRepository();
const tokenStore = new RingTokenStore();
const deviceService = new RingDeviceService();
const owners = new RingCitizenOwnerRepository();
const participants = new RingHomeownerParticipantRepository();

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

/** Best-effort Connect enrollment rows (JWT Lambda may not have these tables). */
async function cleanupConnectEnrollment(agencyId: string, email: string): Promise<void> {
  const needle = email.trim().toLowerCase();
  if (!needle) return;
  try {
    const rows = await participants.listByAgencyId(agencyId);
    for (const row of rows) {
      const match =
        row.email?.trim().toLowerCase() === needle ||
        row.cognitoUsername?.trim().toLowerCase() === needle;
      if (!match) continue;
      if (row.secretsManagerTokenKey) {
        try {
          await tokenStore.deleteTokens(row.secretsManagerTokenKey);
        } catch {
          // Token may already be gone via linked-account cleanup.
        }
      }
      if (row.ringAccountId) {
        try {
          await owners.delete(row.ringAccountId);
        } catch {
          // Citizen owner row is optional.
        }
      }
      try {
        await participants.markExpired(agencyId, row.homeownerId);
      } catch {
        // Participant row is optional.
      }
    }
  } catch {
    // Participant table is not on every Lambda (JWT delete-account).
  }
}

export async function deleteHomeownerAccount(input: {
  userId: string;
  email: string;
  agencyId: string;
}): Promise<void> {
  configureRingEmergencyTables();

  const userPoolId = env.cognitoUserPoolId;
  if (!userPoolId) {
    throw new Error("COGNITO_NOT_CONFIGURED");
  }

  const username = await resolveCognitoUsername(userPoolId, input.userId, input.email);

  await cognito.send(
    new AdminDisableUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    }),
  );

  if (isRingEnabled()) {
    await revokeRingLinkage(input.agencyId, input.userId);
    if (input.email && input.email !== input.userId) {
      await revokeRingLinkage(input.agencyId, input.email);
    }
    await cleanupConnectEnrollment(input.agencyId, input.email);
  }

  await auditRingEvent({
    type: AUDIT_EVENT_TYPES.RING_USER_ACCOUNT_DELETED,
    agencyId: input.agencyId,
    actorId: input.userId,
    details: { reason: "user_requested_account_deletion" },
  });
  await auditRingEvent({
    type: AUDIT_EVENT_TYPES.RING_ACCOUNT_UNLINKED,
    agencyId: input.agencyId,
    actorId: input.userId,
    details: { reason: "user_requested_account_deletion" },
  });

  await cognito.send(
    new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: username,
    }),
  );
}
