import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  isRingEnabled,
  RingApiClient,
  RingAuthError,
  RingOAuthService,
  RingTokenStore,
  RING_ACCOUNT_LINK_URL,
} from "../../lib/ring-integration.js";
import {
  RingCitizenOwnerRepository,
  ringCitizenOwnerPk,
} from "../../repositories/ringCitizenOwnerRepository.js";
import { RingHomeownerParticipantRepository } from "../../repositories/ringHomeownerParticipantRepository.js";
import { RingPublicOAuthStateRepository } from "../../repositories/ringPublicOAuthStateRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { deriveCitizenRingAccountId } from "./ring-citizen-id.js";
import {
  homeownerIdFromPartnerAccount,
  isUnmatchedHomeownerAgency,
} from "./ring-homeowner-id.js";
import { ringRedirect } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const oauth = new RingOAuthService();
const tokenStore = new RingTokenStore();
const owners = new RingCitizenOwnerRepository();
const participants = new RingHomeownerParticipantRepository();
const oauthStates = new RingPublicOAuthStateRepository();

const RING_CITIZEN_MANAGE_URL =
  process.env.RING_CITIZEN_MANAGE_URL?.trim() ||
  (() => {
    const base = (process.env.RING_ACCOUNT_LINK_URL?.trim() || RING_ACCOUNT_LINK_URL)
      .replace(/\/$/, "")
      .replace(/\/link$/, "");
    return `${base}/manage`;
  })();

function linkUrl(
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

function manageUrl(status: "found" | "not_found", token?: string): string {
  const params = new URLSearchParams({ status });
  if (token) params.set("token", token);
  return `${RING_CITIZEN_MANAGE_URL}?${params.toString()}`;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  configureRingEmergencyTables();

  const code = event.queryStringParameters?.code?.trim() ?? "";
  const incomingState = event.queryStringParameters?.state?.trim() ?? "";

  if (!isRingEnabled()) {
    return ringRedirect(linkUrl("error"));
  }

  if (!code || !incomingState) {
    return ringRedirect(linkUrl("error"));
  }

  const stored = await oauthStates.takeState(incomingState);
  if (!stored) {
    return ringRedirect(linkUrl("error"));
  }

  const agencyId = stored.agencyId;
  const usState = stored.usState?.trim().toUpperCase() || null;
  const mode = stored.mode;
  const unmatched = isUnmatchedHomeownerAgency(agencyId);
  const createdAtMs = Date.parse(stored.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return ringRedirect(linkUrl("error", { agencyId }));
  }

  try {
    const tokens = await oauth.exchangeCitizenCode(
      code,
      incomingState,
      stored.state,
      createdAtMs,
      stored.codeVerifier,
    );

    const client = new RingApiClient(tokens.accessToken);
    const profile = await client.getPartnerUserProfile();
    const ringAccountId = deriveCitizenRingAccountId(agencyId, profile.accountId);
    const homeownerId = homeownerIdFromPartnerAccount(profile.accountId);

    if (mode === "manage") {
      const existing = await owners.getByRingAccountId(ringAccountId);
      if (!existing) {
        await auditRingEvent({
          type: AUDIT_EVENT_TYPES.RING_CITIZEN_MANAGE_INITIATED,
          agencyId,
          actorId: ringAccountId,
          details: { outcome: "not_found" },
        });
        return ringRedirect(manageUrl("not_found"));
      }
      const manageToken = await oauthStates.saveManageToken(ringAccountId, agencyId);
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_CITIZEN_MANAGE_INITIATED,
        agencyId,
        actorId: ringAccountId,
        details: { outcome: "found" },
        resourceId: ringAccountId,
      });
      return ringRedirect(manageUrl("found", manageToken));
    }

    // mode === "link": store tokens + participant registration (+ citizen owner when matched).
    const secretKey = await tokenStore.storeCitizenTokens(agencyId, ringAccountId, tokens);

    let deviceIds: string[] = [];
    try {
      const discovered = await client.getDevices();
      deviceIds = discovered.map((d) => d.deviceId);
    } catch (discoveryErr) {
      console.error(
        JSON.stringify({
          msg: "ring_citizen_device_discovery_failed",
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

    // Matched enrollments also write CitizenOwners so dispatcher request flows keep working.
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

    return ringRedirect(
      stored.ringReturnUrl ??
        linkUrl("success", { agencyId, deviceCount: deviceIds.length }),
    );
  } catch (err) {
    if (err instanceof RingAuthError && err.message.toLowerCase().includes("state mismatch")) {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_OAUTH_STATE_MISMATCH,
        agencyId,
        actorId: `citizen-oauth:${agencyId}`,
        details: { flow: mode === "manage" ? "citizen-manage" : "citizen" },
      });
    } else {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_TOKEN_EXCHANGE_FAILED,
        agencyId,
        actorId: `citizen-oauth:${agencyId}`,
        details: { flow: mode === "manage" ? "citizen-manage" : "citizen", reason: "token_exchange_failed" },
      });
    }
    console.error(
      JSON.stringify({
        msg: "ring_public_callback_error",
        agencyId,
        mode,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringRedirect(linkUrl("error", { agencyId }));
  }
};
