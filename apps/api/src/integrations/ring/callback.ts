import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  decodeRingOAuthState,
  isRingEnabled,
  RingApiClient,
  RingAuthError,
  RingDeviceService,
  RingOAuthService,
  RingTokenStore,
  RING_ACCOUNT_LINK_URL,
} from "../../lib/ring-integration.js";
import type { LinkedRingAccount } from "../../lib/ring-integration.js";
import { env } from "../../lib/env.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import {
  RingCitizenOwnerRepository,
  ringCitizenOwnerPk,
} from "../../repositories/ringCitizenOwnerRepository.js";
import { RingHomeownerParticipantRepository } from "../../repositories/ringHomeownerParticipantRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { deriveCitizenRingAccountId } from "./ring-citizen-id.js";
import {
  homeownerIdFromPartnerAccount,
  isUnmatchedHomeownerAgency,
} from "./ring-homeowner-id.js";
import { ringRedirect } from "./ring-api-response.js";
import { syncCognitoPhoneFromRingProfile } from "../../services/ringOwnerNotificationService.js";

const oauth = new RingOAuthService();
const tokenStore = new RingTokenStore();
const accounts = new RingAccountRepository();
const owners = new RingCitizenOwnerRepository();
const participants = new RingHomeownerParticipantRepository();

function staffLinkUrl(status: "success" | "error"): string {
  const base = (process.env.RING_ACCOUNT_LINK_URL?.trim() || RING_ACCOUNT_LINK_URL).replace(/\/$/, "");
  return `${base}?status=${status}`;
}

function homeownerLinkUrl(
  status: "success" | "error",
  opts?: { agencyId?: string; deviceCount?: number },
): string {
  const base = (process.env.RING_ACCOUNT_LINK_URL?.trim() || RING_ACCOUNT_LINK_URL).replace(/\/$/, "");
  const params = new URLSearchParams({ status, audience: "citizen" });
  if (opts?.agencyId && !isUnmatchedHomeownerAgency(opts.agencyId)) {
    params.set("agencyId", opts.agencyId);
  }
  if (typeof opts?.deviceCount === "number") {
    params.set("devices", String(opts.deviceCount));
  }
  return `${base}?${params.toString()}`;
}

function configureRingTables(): void {
  if (env.ringAccountsTable) {
    process.env.RING_TABLE_ACCOUNTS = env.ringAccountsTable;
  }
  if (env.ringDevicesTable) {
    process.env.RING_TABLE_DEVICES = env.ringDevicesTable;
  }
  if (env.ringCitizenOwnersTable) {
    process.env.RING_TABLE_CITIZEN_OWNERS = env.ringCitizenOwnersTable;
  }
  if (env.ringHomeownerParticipantsTable) {
    process.env.RING_TABLE_HOMEOWNER_PARTICIPANTS = env.ringHomeownerParticipantsTable;
  }
}

async function handleHomeownerLink(args: {
  code: string;
  incomingState: string;
  storedState: string;
  agencyId: string;
  oauthUserId: string;
  ringReturnUrl: string | null;
  usState: string | null;
}): Promise<APIGatewayProxyResultV2> {
  const { code, incomingState, storedState, agencyId, oauthUserId, ringReturnUrl, usState } = args;
  const unmatched = isUnmatchedHomeownerAgency(agencyId);

  const finish = async (status: "success" | "error", deviceCount?: number) => {
    try {
      await accounts.deleteOAuthState(agencyId, oauthUserId);
    } catch (cleanupErr) {
      console.error(
        JSON.stringify({
          msg: "ring_homeowner_oauth_state_cleanup_failed",
          agencyId,
          oauthUserId,
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        }),
      );
    }
    if (status === "success" && ringReturnUrl) {
      return ringRedirect(ringReturnUrl);
    }
    return ringRedirect(homeownerLinkUrl(status, { agencyId, deviceCount }));
  };

  try {
    const tokens = await oauth.exchangeCode(code, incomingState, storedState);
    const client = new RingApiClient(tokens.accessToken);
    const profile = await client.getPartnerUserProfile();
    const ringAccountId = deriveCitizenRingAccountId(agencyId, profile.accountId);
    const homeownerId = homeownerIdFromPartnerAccount(profile.accountId);
    const secretKey = await tokenStore.storeCitizenTokens(agencyId, ringAccountId, tokens);

    let deviceIds: string[] = [];
    try {
      const discovered = await client.getDevices();
      deviceIds = discovered.map((d) => d.deviceId);
    } catch (discoveryErr) {
      console.error(
        JSON.stringify({
          msg: "ring_homeowner_device_discovery_failed",
          agencyId,
          ringAccountId,
          error: discoveryErr instanceof Error ? discoveryErr.message : String(discoveryErr),
        }),
      );
    }

    const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    const now = new Date().toISOString();
    const existingParticipant = await participants.getByHomeownerId(homeownerId);

    await participants.upsert({
      homeownerId,
      ringAccountId,
      ...(unmatched ? {} : { agencyId }),
      ...(usState ? { state: usState } : {}),
      deviceCount: deviceIds.length,
      deviceIds,
      secretsManagerTokenKey: secretKey,
      consentGiven: true,
      registeredAt: existingParticipant?.registeredAt ?? now,
      updatedAt: now,
      ...(displayName ? { name: displayName } : existingParticipant?.name ? { name: existingParticipant.name } : {}),
      ...(profile.phoneNumber
        ? { phone: profile.phoneNumber }
        : existingParticipant?.phone
          ? { phone: existingParticipant.phone }
          : {}),
      ...(profile.email
        ? { email: profile.email }
        : existingParticipant?.email
          ? { email: existingParticipant.email }
          : {}),
    });

    if (!unmatched) {
      const existing = await owners.getByRingAccountId(ringAccountId);
      await owners.upsert({
        pk: ringCitizenOwnerPk(ringAccountId),
        ringAccountId,
        agencyId,
        deviceIds,
        secretsManagerTokenKey: secretKey,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ...(displayName ? { name: displayName } : existing?.name ? { name: existing.name } : {}),
        ...(profile.phoneNumber ? { phone: profile.phoneNumber } : existing?.phone ? { phone: existing.phone } : {}),
        ...(profile.email ? { email: profile.email } : existing?.email ? { email: existing.email } : {}),
      });
    }

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CITIZEN_ACCOUNT_LINKED,
      agencyId,
      actorId: homeownerId,
      details: {
        deviceCount: deviceIds.length,
        participantType: "homeowner",
        unmatched,
        ...(usState ? { usState } : {}),
      },
      resourceId: ringAccountId,
    });

    return finish("success", deviceIds.length);
  } catch (err) {
    if (err instanceof RingAuthError && err.message.toLowerCase().includes("state mismatch")) {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_OAUTH_STATE_MISMATCH,
        agencyId,
        actorId: oauthUserId,
        details: { flow: "homeowner" },
      });
    } else {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_TOKEN_EXCHANGE_FAILED,
        agencyId,
        actorId: oauthUserId,
        details: { flow: "homeowner", reason: "token_exchange_failed" },
      });
    }
    console.error(
      JSON.stringify({
        msg: "ring_homeowner_callback_error",
        agencyId,
        oauthUserId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return finish("error");
  }
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  configureRingTables();

  const code = event.queryStringParameters?.code?.trim() ?? "";
  const incomingState = event.queryStringParameters?.state?.trim() ?? "";

  let agencyId = "";
  let userId = "";
  let ringReturnUrl: string | null = null;
  let usState: string | null = null;

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
    if (status === "success" && ringReturnUrl) {
      return ringRedirect(ringReturnUrl);
    }
    return ringRedirect(staffLinkUrl(status));
  };

  if (!code || !incomingState) {
    return finish("error");
  }

  try {
    const parsed = decodeRingOAuthState(incomingState);
    agencyId = parsed.agencyId;
    userId = parsed.userId;
    ringReturnUrl = parsed.ringReturnUrl ?? null;
    usState = parsed.usState ?? null;
  } catch {
    return finish("error");
  }

  const storedState = await accounts.getOAuthState(agencyId, userId);
  if (!storedState) {
    return finish("error");
  }

  // Device-owner enrollments use hw: prefix — keep dispatcher LinkedRingAccount path untouched.
  if (userId.startsWith("hw:")) {
    if (!isRingEnabled()) {
      return ringRedirect(homeownerLinkUrl("error"));
    }
    return handleHomeownerLink({
      code,
      incomingState,
      storedState,
      agencyId,
      oauthUserId: userId,
      ringReturnUrl,
      usState,
    });
  }

  try {
    const tokens = await oauth.exchangeCode(code, incomingState, storedState);
    const client = new RingApiClient(tokens.accessToken);
    let profilePhone: string | undefined;
    let profileEmail: string | undefined;
    try {
      const profile = await client.getPartnerUserProfile();
      profilePhone = profile.phoneNumber;
      profileEmail = profile.email;
      await syncCognitoPhoneFromRingProfile(userId, profilePhone);
    } catch (profileErr) {
      console.error(
        JSON.stringify({
          msg: "ring_staff_profile_phone_sync_failed",
          agencyId,
          userId,
          error: profileErr instanceof Error ? profileErr.message : String(profileErr),
        }),
      );
    }

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

    try {
      const existingOwner = await owners.getByRingAccountId(ringAccountId);
      await owners.upsert({
        pk: ringCitizenOwnerPk(ringAccountId),
        ringAccountId,
        agencyId,
        deviceIds: existingOwner?.deviceIds ?? [],
        secretsManagerTokenKey: secretKey,
        createdAt: existingOwner?.createdAt ?? now,
        updatedAt: now,
        ...(profilePhone ? { phone: profilePhone } : existingOwner?.phone ? { phone: existingOwner.phone } : {}),
        ...(profileEmail ? { email: profileEmail } : existingOwner?.email ? { email: existingOwner.email } : {}),
      });
    } catch (ownerErr) {
      console.error(
        JSON.stringify({
          msg: "ring_staff_citizen_owner_upsert_failed",
          agencyId,
          userId,
          error: ownerErr instanceof Error ? ownerErr.message : String(ownerErr),
        }),
      );
    }

    let deviceCount = 0;
    try {
      const deviceService = new RingDeviceService();
      const devices = await deviceService.discoverAndSaveDevices(
        agencyId,
        userId,
        ringAccountId,
        tokens.accessToken,
        {
          // Staff/reviewer link: enable for Connect when Ring omits GPS use Sonoma Point fallback
          // so certification radius search is not empty.
          enableForConnect: true,
          fallbackLatitude: Number.parseFloat(
            process.env.RING_HOMEOWNER_FALLBACK_LATITUDE ?? "32.5369",
          ),
          fallbackLongitude: Number.parseFloat(
            process.env.RING_HOMEOWNER_FALLBACK_LONGITUDE ?? "-84.9274",
          ),
        },
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
