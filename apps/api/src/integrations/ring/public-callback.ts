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
import { RingPublicOAuthStateRepository } from "../../repositories/ringPublicOAuthStateRepository.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { deriveCitizenRingAccountId } from "./ring-citizen-id.js";
import { ringRedirect } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const oauth = new RingOAuthService();
const tokenStore = new RingTokenStore();
const owners = new RingCitizenOwnerRepository();
const oauthStates = new RingPublicOAuthStateRepository();

function linkUrl(status: "success" | "error"): string {
  const base = (process.env.RING_ACCOUNT_LINK_URL?.trim() || RING_ACCOUNT_LINK_URL).replace(/\/$/, "");
  return `${base}?status=${status}`;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  configureRingEmergencyTables();

  const code = event.queryStringParameters?.code?.trim() ?? "";
  const incomingState = event.queryStringParameters?.state?.trim() ?? "";

  const finish = (status: "success" | "error") => ringRedirect(linkUrl(status));

  if (!isRingEnabled()) {
    return finish("error");
  }

  if (!code || !incomingState) {
    return finish("error");
  }

  const stored = await oauthStates.takeState(incomingState);
  if (!stored) {
    return finish("error");
  }

  const agencyId = stored.agencyId;
  const createdAtMs = Date.parse(stored.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return finish("error");
  }

  try {
    const tokens = await oauth.exchangeCitizenCode(
      code,
      incomingState,
      stored.state,
      createdAtMs,
    );

    const client = new RingApiClient(tokens.accessToken);
    const profile = await client.getPartnerUserProfile();
    const ringAccountId = deriveCitizenRingAccountId(agencyId, profile.accountId);
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

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CITIZEN_ACCOUNT_LINKED,
      agencyId,
      actorId: ringAccountId,
      details: { deviceCount: deviceIds.length },
      resourceId: ringAccountId,
    });

    return finish("success");
  } catch (err) {
    if (err instanceof RingAuthError && err.message.toLowerCase().includes("state mismatch")) {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_OAUTH_STATE_MISMATCH,
        agencyId,
        actorId: `citizen-oauth:${agencyId}`,
        details: { flow: "citizen" },
      });
    } else {
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_TOKEN_EXCHANGE_FAILED,
        agencyId,
        actorId: `citizen-oauth:${agencyId}`,
        details: { flow: "citizen", reason: "token_exchange_failed" },
      });
    }
    console.error(
      JSON.stringify({
        msg: "ring_public_callback_error",
        agencyId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return finish("error");
  }
};
