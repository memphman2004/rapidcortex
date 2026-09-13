/**
 * Wyze camera service — registration, KMS envelope encryption, proximity, consent.
 *
 * @module integrations/cameras/wyze-camera-service
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import { calculateDistanceMeters } from "rapid-cortex-shared";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { env } from "../../lib/env.js";
import { sendSilentTextSms } from "../../lib/silentTextSms.js";
import { wyzeApiClient, type WyzeCamera as WyzeApiCamera } from "./wyze-api.js";
import {
  getConsentByTokenHash,
  getConsentRequest,
  getRegistration,
  getRegistrationByPhone,
  getWyzeCamera,
  listWyzeCamerasForAgency,
  putConsentRequest,
  putRegistration,
  putWyzeCamera,
  updateConsentStatus,
  wyzeCameraId,
  wyzeConsentPk,
  type WyzeCameraRecord,
  type WyzeConsentRequest,
  type WyzeRegistration,
} from "./wyze-tables.js";

const kms = new KMSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const secrets = new SecretsManagerClient({ region: process.env.AWS_REGION ?? "us-east-1" });

const AES_ALGO = "aes-256-gcm" as const;
const IV_BYTES = 12;

type EncryptedBlob = {
  encryptedDataKey: string;
  iv: string;
  ciphertext: string;
  tag: string;
};

function wyzeKmsKeyArn(): string {
  const arn = env.wyzeKmsKeyArn;
  if (!arn) throw new Error("WYZE_KMS_KEY_ARN not configured");
  return arn;
}

async function encryptCredential(plaintext: string): Promise<{ blob: string; keyArn: string }> {
  const keyArn = wyzeKmsKeyArn();
  const dkRes = await kms.send(
    new GenerateDataKeyCommand({ KeyId: keyArn, KeySpec: "AES_256" }),
  );
  const plaintextKey = Buffer.from(dkRes.Plaintext as Uint8Array);
  const encryptedKey = Buffer.from(dkRes.CiphertextBlob as Uint8Array).toString("base64");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_ALGO, plaintextKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  plaintextKey.fill(0);

  const blob: EncryptedBlob = {
    encryptedDataKey: encryptedKey,
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
  return { blob: JSON.stringify(blob), keyArn };
}

async function decryptCredential(blobJson: string): Promise<string> {
  const blob = JSON.parse(blobJson) as EncryptedBlob;
  const decRes = await kms.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(blob.encryptedDataKey, "base64"),
      KeyId: wyzeKmsKeyArn(),
    }),
  );
  const plaintextKey = Buffer.from(decRes.Plaintext as Uint8Array);
  const decipher = createDecipheriv(AES_ALGO, plaintextKey, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const plaintext =
    decipher.update(Buffer.from(blob.ciphertext, "base64")).toString("utf8") +
    decipher.final("utf8");
  plaintextKey.fill(0);
  return plaintext;
}

let cachedHmacSecret: string | undefined;

async function tokenHmacSecret(): Promise<string> {
  if (cachedHmacSecret) return cachedHmacSecret;
  const direct = process.env.WYZE_CONSENT_TOKEN_SECRET?.trim();
  if (direct) {
    cachedHmacSecret = direct;
    return direct;
  }
  const arn = process.env.WYZE_CONSENT_HMAC_SECRET_ARN?.trim();
  if (!arn) throw new Error("WYZE_CONSENT_TOKEN_SECRET / WYZE_CONSENT_HMAC_SECRET_ARN not configured");
  const out = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  const value = out.SecretString?.trim();
  if (!value) throw new Error("Wyze consent HMAC secret is empty");
  cachedHmacSecret = value;
  return value;
}

async function generateConsentToken(): Promise<{ plainToken: string; tokenHash: string }> {
  const secret = await tokenHmacSecret();
  const plainToken = randomBytes(16).toString("base64url");
  const tokenHash = createHmac("sha256", secret).update(plainToken).digest("hex");
  return { plainToken, tokenHash };
}

async function hashToken(plainToken: string): Promise<string> {
  const secret = await tokenHmacSecret();
  return createHmac("sha256", secret).update(plainToken).digest("hex");
}

function consentLandingUrl(plainToken: string): string {
  const base =
    process.env.CONNECT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    process.env.RING_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
    env.ringPublicApiBaseUrl.replace(/\/$/, "") ||
    "https://api.rapidcortex.us";
  return `${base}/api/cameras/providers/wyze/c/${plainToken}`;
}

export type RegisterWyzeInput = {
  agencyId: string;
  email: string;
  phone: string;
  keyId: string;
  apiKey: string;
  address: string;
  lat: number;
  lng: number;
};

export type RegisterWyzeResult = {
  ownerId: string;
  camerasFound: number;
};

export async function registerWyzeHomeowner(
  input: RegisterWyzeInput,
): Promise<RegisterWyzeResult> {
  const existing = await getRegistrationByPhone(input.phone, input.agencyId);
  const creds = { keyId: input.keyId, apiKey: input.apiKey };
  const apiCameras = await wyzeApiClient.listCameras(creds);

  const [encKeyResult, encApiResult] = await Promise.all([
    encryptCredential(input.keyId),
    encryptCredential(input.apiKey),
  ]);

  const ownerId = existing?.ownerId ?? randomUUID();
  const now = new Date().toISOString();
  const registration: WyzeRegistration = {
    ownerId,
    agencyId: input.agencyId,
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    encryptedKeyId: encKeyResult.blob,
    encryptedApiKey: encApiResult.blob,
    encryptionKeyArn: encKeyResult.keyArn,
    address: input.address.trim(),
    lat: input.lat,
    lng: input.lng,
    active: true,
    registeredAt: existing?.registeredAt ?? now,
    lastVerifiedAt: now,
  };
  await putRegistration(registration);

  await Promise.all(
    apiCameras.map((cam: WyzeApiCamera) =>
      putWyzeCamera({
        agencyId: input.agencyId,
        cameraId: wyzeCameraId(cam.mac),
        mac: cam.mac,
        ownerId,
        provider: "wyze",
        ownership: "citizen",
        displayName: cam.name,
        model: cam.model,
        latitude: input.lat,
        longitude: input.lng,
        address: input.address,
        ownerPhone: input.phone.trim(),
        active: true,
        addedAt: now,
      }),
    ),
  );

  return { ownerId, camerasFound: apiCameras.length };
}

export type NearbyWyzeCamera = WyzeCameraRecord & {
  distanceMeters: number;
  ownerStatus: WyzeConsentRequest["requestStatus"] | "AVAILABLE";
  requestId?: string;
};

export function wyzeCameraDistanceMeters(
  camera: Pick<WyzeCameraRecord, "latitude" | "longitude">,
  lat: number,
  lng: number,
): number {
  return calculateDistanceMeters(lat, lng, camera.latitude, camera.longitude);
}

export function isApprovedUnexpiredWyzeConsent(
  consent: WyzeConsentRequest | null,
  agencyId: string,
): boolean {
  if (!consent || consent.agencyId !== agencyId) return false;
  if (consent.requestStatus !== "APPROVED") return false;
  return new Date(consent.expiresAt).getTime() > Date.now();
}

export async function listWyzeCamerasNearIncident(
  agencyId: string,
  lat: number,
  lng: number,
  radiusMeters: number,
  incidentId: string,
): Promise<NearbyWyzeCamera[]> {
  const candidates = await listWyzeCamerasForAgency(agencyId);
  const nearby: NearbyWyzeCamera[] = [];

  for (const c of candidates) {
    const distanceMeters = wyzeCameraDistanceMeters(c, lat, lng);
    if (distanceMeters > radiusMeters) continue;
    const consent = await getConsentRequest(wyzeConsentPk(agencyId, incidentId, c.mac));
    const expired =
      consent && new Date(consent.expiresAt).getTime() <= Date.now()
        ? "EXPIRED"
        : consent?.requestStatus;
    nearby.push({
      ...c,
      distanceMeters: Math.floor(distanceMeters / 10) * 10,
      ownerStatus: expired ?? "AVAILABLE",
      requestId: consent?.requestId,
    });
  }
  nearby.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return nearby;
}

export type ConsentRequestInput = {
  agencyId: string;
  incidentId: string;
  mac: string;
  requestedDurationMinutes: 10 | 30 | 60 | 120;
  agencyName: string;
};

export async function createWyzeConsentRequest(
  input: ConsentRequestInput,
): Promise<{ requestId: string; status: "SENT" | "NO_PHONE" | "DRAFT" }> {
  const camera = await getWyzeCamera(input.agencyId, input.mac);
  if (!camera) throw new Error(`Camera not found: ${input.mac}`);

  const existing = await getConsentRequest(
    wyzeConsentPk(input.agencyId, input.incidentId, input.mac),
  );
  if (existing && (existing.requestStatus === "SENT" || existing.requestStatus === "APPROVED")) {
    const stillOpen = new Date(existing.expiresAt).getTime() > Date.now();
    if (stillOpen) {
      throw Object.assign(new Error("An active request already exists for this camera"), {
        statusCode: 409,
      });
    }
  }

  const { plainToken, tokenHash } = await generateConsentToken();
  const requestId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + (input.requestedDurationMinutes + 30) * 60 * 1000,
  ).toISOString();
  const requestPk = wyzeConsentPk(input.agencyId, input.incidentId, input.mac);
  const ttl = Math.floor(Date.parse(expiresAt) / 1000) + 7 * 24 * 60 * 60;

  const consentRequest: WyzeConsentRequest = {
    requestPk,
    requestId,
    tokenHash,
    ownerId: camera.ownerId,
    agencyId: input.agencyId,
    incidentId: input.incidentId,
    mac: input.mac,
    deviceName: camera.displayName,
    requestStatus: "SENT",
    requestedDurationMinutes: input.requestedDurationMinutes,
    expiresAt,
    createdAt: now.toISOString(),
    ttl,
  };

  const phone = camera.ownerPhone?.trim();
  if (!phone) {
    await putConsentRequest({ ...consentRequest, requestStatus: "NO_PHONE" });
    return { requestId, status: "NO_PHONE" };
  }

  await putConsentRequest(consentRequest);
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
      console.error("[wyze/request] sms failed", sms.errorMessage ?? sms.errorCode);
      await updateConsentStatus(requestPk, "DRAFT", now.toISOString());
      return { requestId, status: "DRAFT" };
    }
  } catch (err) {
    console.error("[wyze/request] sms failed", err);
    await updateConsentStatus(requestPk, "DRAFT", now.toISOString());
    return { requestId, status: "DRAFT" };
  }

  return { requestId, status: "SENT" };
}

export async function resolveWyzeConsentToken(
  plainToken: string,
  decision: "APPROVED" | "DECLINED",
): Promise<{ requestId: string; mac: string; agencyId: string; expiresAt: string } | null> {
  const request = await getConsentByTokenHash(await hashToken(plainToken));
  if (!request) return null;
  if (request.requestStatus !== "SENT") return null;
  if (new Date(request.expiresAt).getTime() <= Date.now()) return null;

  const resolvedAt = new Date().toISOString();
  await updateConsentStatus(request.requestPk, decision, resolvedAt);
  return {
    requestId: request.requestId,
    mac: request.mac,
    agencyId: request.agencyId,
    expiresAt: request.expiresAt,
  };
}

export async function peekWyzeConsentRequest(
  plainToken: string,
): Promise<WyzeConsentRequest | null> {
  return getConsentByTokenHash(await hashToken(plainToken));
}

export async function getApprovedWyzeStreamContext(
  agencyId: string,
  incidentId: string,
  mac: string,
): Promise<{ camera: WyzeCameraRecord; creds: { keyId: string; apiKey: string } } | null> {
  const camera = await getWyzeCamera(agencyId, mac);
  if (!camera || camera.agencyId !== agencyId) return null;

  const consent = await getConsentRequest(wyzeConsentPk(agencyId, incidentId, mac));
  if (!isApprovedUnexpiredWyzeConsent(consent, agencyId)) return null;

  const owner = await getRegistration(camera.ownerId);
  if (!owner || !owner.active || owner.agencyId !== agencyId) return null;

  const [keyId, apiKey] = await Promise.all([
    decryptCredential(owner.encryptedKeyId),
    decryptCredential(owner.encryptedApiKey),
  ]);
  return { camera, creds: { keyId, apiKey } };
}
