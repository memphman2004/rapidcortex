/**
 * Google Nest SDM — camera service layer.
 *
 * Functions imported by cameras-providers-handler.ts:
 *   getValidNestAccess, loadNestToken, listAgencyNestCameras,
 *   listCitizenNestNearIncident, createNestConsentRequest,
 *   peekNestConsentRequest, resolveNestConsentToken
 *
 * Consent SMS uses AWS End User Messaging via sendSilentTextSms.
 *
 * @module integrations/cameras/nest-camera-service
 */

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { calculateDistanceMeters } from "rapid-cortex-shared";
import { sendSilentTextSms } from "../../lib/silentTextSms.js";
import { env } from "../../lib/env.js";
import { nestSdmClient } from "./nest-sdm.js";
import { getNestRcOauthCredentials, nestRefreshAgencyToken, RCError } from "./nest-oauth.js";
import {
  getNestConsentByTokenHash,
  getNestToken,
  listCitizenAccountsForAgency,
  listNestConsentForIncident,
  nestAgencyIncidentId,
  putNestConsentRequest,
  queryCitizenAccountsNear,
  updateCitizenTokens,
  updateNestConsentStatus,
  type NestAgencyToken,
  type NestCitizenAccount,
  type NestConsentRequest,
} from "./nest-tables.js";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const secrets = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

let cachedHmacSecret: string | undefined;

async function tokenHmacSecret(): Promise<string> {
  if (cachedHmacSecret) return cachedHmacSecret;
  const direct = process.env.NEST_CONSENT_TOKEN_SECRET?.trim();
  if (direct) {
    cachedHmacSecret = direct;
    return direct;
  }
  const arn = process.env.NEST_CONSENT_HMAC_SECRET_ARN?.trim() || env.nestConsentHmacSecretArn;
  if (!arn) {
    throw new RCError("NEST_CONSENT_HMAC_SECRET_ARN not configured", 500);
  }
  const out = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  const value = out.SecretString?.trim();
  if (!value) throw new RCError("Nest consent HMAC secret is empty", 500);
  cachedHmacSecret = value;
  return value;
}

async function generateConsentToken(): Promise<{ plainToken: string; tokenHash: string }> {
  const secret = await tokenHmacSecret();
  const plainToken = randomBytes(16).toString("base64url");
  const tokenHash = createHmac("sha256", secret).update(plainToken).digest("hex");
  return { plainToken, tokenHash };
}

async function hashConsentToken(plainToken: string): Promise<string> {
  const secret = await tokenHmacSecret();
  return createHmac("sha256", secret).update(plainToken).digest("hex");
}

function consentLandingUrl(plainToken: string): string {
  const base =
    process.env.CONNECT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.RING_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    env.ringPublicApiBaseUrl.replace(/\/$/, "") ||
    "https://api.rapidcortex.us";
  return `${base}/api/cameras/providers/nest/c/${plainToken}`;
}

export type ValidNestAccess = {
  token: NestAgencyToken;
  accessToken: string;
};

export async function getValidNestAccess(agencyId: string): Promise<ValidNestAccess> {
  const token = await getNestToken(agencyId);
  if (!token?.accessToken || !token.projectId) {
    throw new RCError(
      "Nest account not linked. Complete OAuth setup in Settings → Integrations.",
      424,
    );
  }

  if (token.expiresAt - Date.now() >= TOKEN_REFRESH_BUFFER_MS) {
    return { token, accessToken: token.accessToken };
  }

  const freshAccessToken = await nestRefreshAgencyToken(agencyId);
  return {
    token: { ...token, accessToken: freshAccessToken },
    accessToken: freshAccessToken,
  };
}

export async function loadNestToken(agencyId: string): Promise<NestAgencyToken | null> {
  return getNestToken(agencyId);
}

export type NestAgencyCamera = {
  deviceId: string;
  displayName: string;
  type: string;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  traits: Record<string, unknown>;
};

export async function listAgencyNestCameras(agencyId: string): Promise<NestAgencyCamera[]> {
  const { token, accessToken } = await getValidNestAccess(agencyId);
  const devices = await nestSdmClient.listDevices(token.projectId, accessToken);
  return devices
    .filter((d) => d.hasLiveStream)
    .map((d) => ({
      deviceId: d.deviceId,
      displayName: d.displayName,
      type: d.type,
      status: d.status,
      traits: d.traits,
    }));
}

export type NestConsentStatusUi =
  | "AVAILABLE"
  | "DRAFT"
  | "SENT"
  | "APPROVED"
  | "DECLINED"
  | "EXPIRED"
  | "REVOKED"
  | "NO_PHONE";

export type NestCitizenCamera = {
  deviceId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  ownerPhone?: string;
  distanceMeters: number;
  ownerStatus: NestConsentStatusUi;
  requestId?: string;
  accountId: string;
  address: string;
};

/**
 * Nearby citizen Nest cameras for an RC incident.
 *
 * `lat`/`lng` must come from `requireActiveIncident` + `incidentCoordinates`
 * (canonical RC incident geocode). This function must not import Ring incident
 * helpers — agency isolation is already enforced by the caller.
 */
export async function listCitizenNestNearIncident(
  agencyId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  incidentId: string,
): Promise<NestCitizenCamera[]> {
  const candidates = await queryCitizenAccountsNear(lat, lng, agencyId, radiusMeters);
  const consents = await listNestConsentForIncident(agencyId, incidentId);
  const latestByDevice = new Map<string, NestConsentRequest>();
  for (const r of consents) {
    const prev = latestByDevice.get(r.deviceId);
    if (!prev || r.createdAt > prev.createdAt) latestByDevice.set(r.deviceId, r);
  }

  const results: NestCitizenCamera[] = [];

  for (const account of candidates) {
    const dist = calculateDistanceMeters(lat, lng, account.lat, account.lng);
    if (dist > radiusMeters) continue;

    let accessToken = account.accessToken;
    if (account.tokenExpiresAt - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
      try {
        accessToken = await refreshCitizenToken(account);
      } catch (err) {
        console.error("[nest/citizen] token refresh skipped", account.accountId, err);
        continue;
      }
    }

    try {
      const devices = await nestSdmClient.listDevices(account.projectId, accessToken);
      for (const device of devices.filter((d) => d.hasLiveStream)) {
        const latest = latestByDevice.get(device.deviceId);
        results.push({
          accountId: account.accountId,
          deviceId: device.deviceId,
          displayName: device.displayName,
          latitude: account.lat,
          longitude: account.lng,
          address: account.address,
          ownerPhone: account.phone,
          distanceMeters: Math.floor(dist / 10) * 10,
          ownerStatus: (latest?.requestStatus as NestConsentStatusUi | undefined) ?? "AVAILABLE",
          requestId: latest?.requestId,
        });
      }
    } catch (err) {
      console.error("[nest/citizen] listDevices skipped", account.accountId, err);
    }
  }

  return results.sort((a, b) => a.distanceMeters - b.distanceMeters);
}

async function refreshCitizenToken(account: NestCitizenAccount): Promise<string> {
  const creds = await getNestRcOauthCredentials();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`Citizen token refresh failed: ${json.error ?? "unknown"}`);
  }
  const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  await updateCitizenTokens(account.accountId, json.access_token, expiresAt, json.refresh_token);
  return json.access_token;
}

export type CreateNestConsentInput = {
  agencyId: string;
  incidentId: string;
  deviceId: string;
  requestedDurationMinutes: 10 | 30 | 60 | 120;
  agencyName: string;
};

export type CreateNestConsentResult = {
  requestId: string;
  status: "SENT" | "DRAFT" | "NO_PHONE";
};

export async function createNestConsentRequest(
  input: CreateNestConsentInput,
): Promise<CreateNestConsentResult> {
  const account = await findCitizenByDeviceId(input.deviceId, input.agencyId);
  if (!account) {
    throw new RCError(`No registered citizen account found for device: ${input.deviceId}`, 404);
  }

  const existing = (await listNestConsentForIncident(input.agencyId, input.incidentId)).filter(
    (r) => r.deviceId === input.deviceId,
  );
  const blocking = existing.find((r) => r.requestStatus === "SENT" || r.requestStatus === "APPROVED");
  if (blocking) {
    throw new RCError("An active request already exists for this camera", 409);
  }

  let deviceName = input.deviceId;
  try {
    const devices = await nestSdmClient.listDevices(account.projectId, account.accessToken);
    const match = devices.find((d) => d.deviceId === input.deviceId);
    if (match) deviceName = match.displayName;
  } catch {
    // Non-fatal — fallback to deviceId as name
  }

  const { plainToken, tokenHash } = await generateConsentToken();
  const requestId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (input.requestedDurationMinutes + 30) * 60 * 1000,
  ).toISOString();
  const ttl = Math.floor(Date.parse(expiresAt) / 1000);

  const record: NestConsentRequest = {
    requestId,
    tokenHash,
    agencyId: input.agencyId,
    incidentId: input.incidentId,
    agencyIncidentId: nestAgencyIncidentId(input.agencyId, input.incidentId),
    citizenAccountId: account.accountId,
    deviceId: input.deviceId,
    deviceName,
    requestStatus: "DRAFT",
    requestedDurationMinutes: input.requestedDurationMinutes,
    expiresAt,
    createdAt: now.toISOString(),
    ttl,
  };
  await putNestConsentRequest(record);

  const phone = account.phone?.trim();
  if (!phone) {
    await putNestConsentRequest({ ...record, requestStatus: "NO_PHONE" });
    return { requestId, status: "NO_PHONE" };
  }

  const consentUrl = consentLandingUrl(plainToken);
  const message = [
    `Rapid Cortex: ${input.agencyName} requests ${input.requestedDurationMinutes}-min live camera view for an active emergency near you.`,
    `Approve or decline: ${consentUrl}`,
    "Reply STOP to opt out.",
  ].join("\n");

  try {
    const sms = await sendSilentTextSms({
      phoneE164: phone,
      message,
      agencyId: input.agencyId,
      incidentId: input.incidentId,
    });
    if (!sms.ok) {
      console.error("[nest/request] sms failed", sms.errorMessage ?? sms.errorCode);
      return { requestId, status: "DRAFT" };
    }
    await putNestConsentRequest({ ...record, requestStatus: "SENT" });
    return { requestId, status: "SENT" };
  } catch (err) {
    console.error("[nest/request] sms failed", err);
    return { requestId, status: "DRAFT" };
  }
}

export async function peekNestConsentRequest(plainToken: string): Promise<{
  deviceName: string;
  requestedDurationMinutes: number;
  requestStatus: string;
  expiresAt: string;
} | null> {
  const tokenHash = await hashConsentToken(plainToken);
  const row = await getNestConsentByTokenHash(tokenHash);
  if (!row) return null;
  return {
    deviceName: row.deviceName ?? "camera",
    requestedDurationMinutes: row.requestedDurationMinutes,
    requestStatus: row.requestStatus,
    expiresAt: row.expiresAt,
  };
}

export async function resolveNestConsentToken(
  plainToken: string,
  decision: "APPROVED" | "DECLINED",
): Promise<{ agencyId: string; incidentId: string } | null> {
  const tokenHash = await hashConsentToken(plainToken);
  const request = await getNestConsentByTokenHash(tokenHash);
  if (!request) return null;
  if (request.requestStatus !== "SENT") return null;
  if (new Date(request.expiresAt).getTime() <= Date.now()) return null;

  await updateNestConsentStatus(request.requestId, decision, new Date().toISOString());
  return { agencyId: request.agencyId, incidentId: request.incidentId };
}

async function findCitizenByDeviceId(
  deviceId: string,
  agencyId: string,
): Promise<NestCitizenAccount | null> {
  const accounts = await listCitizenAccountsForAgency(agencyId);
  for (const account of accounts) {
    try {
      const devices = await nestSdmClient.listDevices(account.projectId, account.accessToken);
      if (devices.some((d) => d.deviceId === deviceId)) return account;
    } catch {
      // Skip stale token or offline account
    }
  }
  return null;
}
