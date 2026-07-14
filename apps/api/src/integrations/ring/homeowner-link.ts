import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { ringHomeownerLinkBodySchema } from "rapid-cortex-shared";
import type { LinkedRingAccount } from "../../lib/ring-integration.js";
import {
  RingApiClient,
  RingDeviceService,
  RingTokenStore,
  RingUnclaimedTokenService,
  RING_HOMEOWNER_DEFAULT_AGENCY_ID,
  RING_HOMEOWNER_FALLBACK_LATITUDE,
  RING_HOMEOWNER_FALLBACK_LONGITUDE,
  isRingEnabled,
  maskEmailForRing,
  patchRingAppIntegrationCompleted,
  postRingAppIntegration,
  validateRingLinkTimestamp,
} from "../../lib/ring-integration.js";
import { env } from "../../lib/env.js";
import { RingAccountRepository } from "../../repositories/ringAccountRepository.js";
import {
  RingCitizenOwnerRepository,
  ringCitizenOwnerPk,
} from "../../repositories/ringCitizenOwnerRepository.js";
import { RingHomeownerParticipantRepository } from "../../repositories/ringHomeownerParticipantRepository.js";
import { authenticateHomeowner } from "./homeowner-cognito.js";
import { deriveCitizenRingAccountId } from "./ring-citizen-id.js";
import { homeownerIdFromPartnerAccount } from "./ring-homeowner-id.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { consumeRingPublicOAuthRateSlot } from "./ring-consent-rate-limit.js";
import { configureRingEmergencyTables } from "./ring-tables.js";
import { ringPublicClientIp, ringPublicJson } from "./ring-public-cors.js";

const unclaimedService = new RingUnclaimedTokenService();
const tokenStore = new RingTokenStore();
const deviceService = new RingDeviceService();
const accounts = new RingAccountRepository();
const owners = new RingCitizenOwnerRepository();
const participants = new RingHomeownerParticipantRepository();

async function syncHomeownerPhone(email: string, phoneE164: string | undefined): Promise<void> {
  const pool = env.cognitoUserPoolId;
  const phone = phoneE164?.trim();
  if (!pool || !phone) return;
  try {
    await new CognitoIdentityProviderClient({}).send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: pool,
        Username: email,
        UserAttributes: [{ Name: "phone_number", Value: phone.startsWith("+") ? phone : `+${phone}` }],
      }),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_homeowner_phone_sync_failed",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/**
 * Appstore Account Link completion after mandatory partner sign-in/up.
 * Matches nonce → POST/PATCH app-integrations → discover devices under test-agency.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  configureRingEmergencyTables();

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

    const parsed = ringHomeownerLinkBodySchema.safeParse(body);
    if (!parsed.success) {
      return ringPublicJson(event, 400, { success: false, error: "Invalid request body." });
    }

    const { email, password, mode, nonce, time } = parsed.data;
    const freshness = validateRingLinkTimestamp(time);
    if (!freshness.ok) {
      return ringPublicJson(event, 400, {
        success: false,
        error: freshness.reason === "expired" ? "Link request expired." : "Invalid link timestamp.",
      });
    }

    let auth;
    try {
      auth = await authenticateHomeowner({ email, password, mode });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AUTH_FAILED";
      if (msg.startsWith("AUTH_CHALLENGE:")) {
        return ringPublicJson(event, 403, {
          success: false,
          error: "Additional authentication is required. Contact support.",
        });
      }
      if (msg === "AUTH_FAILED" || msg.includes("NotAuthorized") || msg.includes("UserNotFound")) {
        return ringPublicJson(event, 401, {
          success: false,
          error: "Invalid email or password.",
        });
      }
      if (msg.includes("InvalidPassword") || msg.includes("Password")) {
        return ringPublicJson(event, 400, {
          success: false,
          error:
            "Password must be at least 12 characters and include upper, lower, number, and symbol.",
        });
      }
      console.error(JSON.stringify({ msg: "ring_homeowner_auth_error", error: msg }));
      return ringPublicJson(event, 500, { success: false, error: "Unable to sign in." });
    }

    await auditRingEvent({
      type: auth.created
        ? AUDIT_EVENT_TYPES.RING_HOMEOWNER_SIGNED_UP
        : AUDIT_EVENT_TYPES.RING_HOMEOWNER_SIGNED_IN,
      agencyId: auth.agencyId,
      actorId: auth.userId,
      details: { email: auth.email, mode },
    });

    const matched = await unclaimedService.matchNonce(nonce, time);
    if (!matched) {
      return ringPublicJson(event, 404, {
        success: false,
        error: "No matching Ring link found. Return to the Ring app and try again.",
      });
    }

    const { record: unclaimed, tokens } = matched;
    const partnerAccountId = unclaimed.accountId;
    const accessToken = tokens.accessToken;
    const masked = maskEmailForRing(auth.email);

    const agencyId = RING_HOMEOWNER_DEFAULT_AGENCY_ID;
    const userId = auth.userId;
    const ringAccountId = deriveCitizenRingAccountId(agencyId, partnerAccountId);
    const homeownerId = homeownerIdFromPartnerAccount(partnerAccountId);
    const now = new Date().toISOString();

    // Persist tokens before Ring finalize so a Secrets Manager failure cannot leave
    // Ring in "completed" while we have no local claim (forces Invalid Nonce on retry).
    let secretKey: string;
    try {
      secretKey = await tokenStore.storeTokens(agencyId, userId, tokens);
      await tokenStore.storeCitizenTokens(agencyId, ringAccountId, tokens);
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "ring_homeowner_token_store_failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return ringPublicJson(event, 500, {
        success: false,
        error: "Could not securely store Ring credentials. Try again in a moment.",
      });
    }

    try {
      await postRingAppIntegration(accessToken, {
        account_identifier: masked,
        nonce,
      });
      await patchRingAppIntegrationCompleted(accessToken, masked);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Idempotent retry: first attempt may have completed Ring POST/PATCH then failed
      // later locally. Ring then rejects the same nonce.
      const alreadyFinalized =
        /Invalid Nonce/i.test(message) ||
        /nonce validation failed/i.test(message) ||
        /already/i.test(message);
      console.error(
        JSON.stringify({
          msg: "ring_app_integrations_failed",
          error: message,
          alreadyFinalized,
        }),
      );
      if (!alreadyFinalized) {
        return ringPublicJson(event, 502, {
          success: false,
          error: "Could not finalize Ring account link.",
        });
      }
      try {
        await patchRingAppIntegrationCompleted(accessToken, masked);
      } catch {
        // Non-fatal when Ring already marked the integration completed.
      }
    }

    const profile = await new RingApiClient(accessToken).getPartnerUserProfile();
    await syncHomeownerPhone(auth.email, profile.phoneNumber);

    const scopes = tokens.scope.split(/\s+/).filter(Boolean);
    const existingAccount = await accounts.getLinkedAccount(agencyId, userId);
    const linked: LinkedRingAccount = {
      agencyId,
      userId,
      ringAccountId,
      connectionStatus: "CONNECTED",
      scopes,
      secretsManagerTokenKey: secretKey,
      createdAt: existingAccount?.createdAt ?? now,
      updatedAt: now,
      lastTokenRefreshAt: now,
    };
    await accounts.upsertLinkedAccount(linked);

    let devices: Awaited<ReturnType<RingDeviceService["discoverAndSaveDevices"]>> = [];
    try {
      devices = await deviceService.discoverAndSaveDevices(
        agencyId,
        userId,
        ringAccountId,
        accessToken,
        {
          enableForConnect: true,
          fallbackLatitude: RING_HOMEOWNER_FALLBACK_LATITUDE,
          fallbackLongitude: RING_HOMEOWNER_FALLBACK_LONGITUDE,
        },
      );
    } catch (discoveryErr) {
      console.error(
        JSON.stringify({
          msg: "ring_homeowner_appstore_device_discovery_failed",
          agencyId,
          userId,
          error: discoveryErr instanceof Error ? discoveryErr.message : String(discoveryErr),
        }),
      );
    }

    const deviceIds = devices.map((d) => d.deviceId);
    const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
    const existingParticipant = await participants.getByHomeownerId(homeownerId);

    await participants.upsert({
      homeownerId,
      ringAccountId,
      agencyId,
      deviceCount: deviceIds.length,
      deviceIds,
      secretsManagerTokenKey: secretKey,
      consentGiven: true,
      registeredAt: existingParticipant?.registeredAt ?? now,
      updatedAt: now,
      ...(displayName ? { name: displayName } : {}),
      ...(profile.phoneNumber ? { phone: profile.phoneNumber } : {}),
      email: auth.email,
    });

    const existingOwner = await owners.getByRingAccountId(ringAccountId);
    await owners.upsert({
      pk: ringCitizenOwnerPk(ringAccountId),
      ringAccountId,
      agencyId,
      deviceIds,
      secretsManagerTokenKey: secretKey,
      createdAt: existingOwner?.createdAt ?? now,
      updatedAt: now,
      ...(displayName ? { name: displayName } : {}),
      ...(profile.phoneNumber ? { phone: profile.phoneNumber } : {}),
      email: auth.email,
    });

    await unclaimedService.claim(partnerAccountId, userId);

    // Move tokens out of unclaimed secret into claimed paths (best-effort delete unclaimed secret).
    try {
      await tokenStore.deleteTokens(unclaimed.secretKey);
    } catch {
      // non-fatal
    }

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_APPSTORE_ACCOUNT_LINKED,
      agencyId,
      actorId: userId,
      details: {
        deviceCount: deviceIds.length,
        ringPartnerAccountId: partnerAccountId,
        devices: devices.map((d) => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          latitude: d.latitude,
          longitude: d.longitude,
          isEnabledForConnect: d.isEnabledForConnect,
        })),
      },
      resourceId: ringAccountId,
    });

    return ringPublicJson(event, 200, {
      success: true,
      data: {
        status: "completed",
        agencyId,
        deviceCount: deviceIds.length,
        devices: devices.map((d) => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          isEnabledForConnect: d.isEnabledForConnect,
          hasCoordinates: d.latitude != null && d.longitude != null,
        })),
      },
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_homeowner_link_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringPublicJson(event, 500, { success: false, error: "Unable to complete Ring linking." });
  }
};
