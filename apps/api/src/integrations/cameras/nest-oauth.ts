/**
 * Google Nest SDM — OAuth 2.0 for agency device linking and citizen enrollment.
 *
 * Agency flow:
 *   1. Admin POSTs projectId + clientId + clientSecret
 *   2. nestBuildOAuthUrl() stores a single-use nonce with the KMS-encrypted secret
 *   3. Google redirects to /api/cameras/providers/nest/callback?code=&state=
 *   4. nestHandleCallback() exchanges the code and persists tokens
 *
 * Citizen enrollment uses RC's own Device Access project (Secrets Manager),
 * not the agency project. Without those credentials the citizen path returns 503.
 *
 * @module integrations/cameras/nest-oauth
 */

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from "@aws-sdk/client-kms";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { env } from "../../lib/env.js";
import {
  getNestToken,
  putCitizenAccount,
  putNestToken,
  putOAuthState,
  getAndDeleteOAuthState,
  updateNestAccessToken,
  type NestOAuthKind,
} from "./nest-tables.js";

export class RCError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "RCError";
  }
}

const GOOGLE_AUTH_BASE = "https://nestservices.google.com/partnerconnect";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SDM_SCOPE = "https://www.googleapis.com/auth/sdm.service";
const STATE_TTL_S = 600;

const kms = new KMSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const AES_ALGO = "aes-256-gcm" as const;
const IV_BYTES = 12;

type EncBlob = { encryptedDataKey: string; iv: string; ciphertext: string; tag: string };

type NestRcOauthCredentials = {
  clientId: string;
  clientSecret: string;
  projectId: string;
};

let cachedRcOauth: NestRcOauthCredentials | null | undefined;

async function encryptSecret(plaintext: string): Promise<{ blob: string; keyArn: string }> {
  const keyArn = env.nestKmsKeyArn;
  if (!keyArn) throw new RCError("NEST_KMS_KEY_ARN not configured", 500);

  const dkRes = await kms.send(new GenerateDataKeyCommand({ KeyId: keyArn, KeySpec: "AES_256" }));
  const plaintextKey = Buffer.from(dkRes.Plaintext as Uint8Array);
  const encDataKey = Buffer.from(dkRes.CiphertextBlob as Uint8Array).toString("base64");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(AES_ALGO, plaintextKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  plaintextKey.fill(0);

  const blob: EncBlob = {
    encryptedDataKey: encDataKey,
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
  return { blob: JSON.stringify(blob), keyArn };
}

async function decryptSecret(blobJson: string): Promise<string> {
  const b = JSON.parse(blobJson) as EncBlob;
  const decRes = await kms.send(
    new DecryptCommand({ CiphertextBlob: Buffer.from(b.encryptedDataKey, "base64") }),
  );
  const dataKey = Buffer.from(decRes.Plaintext as Uint8Array);
  const decipher = createDecipheriv(AES_ALGO, dataKey, Buffer.from(b.iv, "base64"));
  decipher.setAuthTag(Buffer.from(b.tag, "base64"));
  const plain =
    decipher.update(Buffer.from(b.ciphertext, "base64")).toString("utf8") + decipher.final("utf8");
  dataKey.fill(0);
  return plain;
}

export function nestRedirectUri(): string {
  const explicit = process.env.NEST_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  const apiBase = process.env.API_BASE_URL?.trim().replace(/\/$/, "") || "https://api.rapidcortex.us";
  return `${apiBase}/api/cameras/providers/nest/callback`;
}

/**
 * Admin Integrations page that receives `?nest=connected|error` after OAuth.
 */
export function nestAccountLinkUrl(): string {
  const explicit = process.env.NEST_ACCOUNT_LINK_URL?.trim();
  if (explicit) return explicit;
  const appBase =
    process.env.APP_PUBLIC_BASE_URL?.trim().replace(/\/$/, "") || "https://app.rapidcortex.us";
  const slug = process.env.NEXT_PUBLIC_DEFAULT_JURISDICTION_SLUG?.trim() || "example-city";
  return `${appBase}/${slug}/admin/integrations`;
}

export function nestCitizenLinkUrl(): string {
  return (
    process.env.NEST_CITIZEN_LINK_URL?.trim() ||
    "https://www.rapidcortex.us/connect/nest"
  );
}

export async function getNestRcOauthCredentials(): Promise<NestRcOauthCredentials> {
  if (cachedRcOauth) return cachedRcOauth;
  if (cachedRcOauth === null) {
    throw new RCError(
      "Citizen Nest enrollment is not configured. Rapid Cortex must complete Google Device Access project approval.",
      503,
    );
  }

  const arn = env.nestRcOauthSecretArn;
  if (!arn) {
    cachedRcOauth = null;
    throw new RCError(
      "Citizen Nest enrollment is not configured. Rapid Cortex must complete Google Device Access project approval.",
      503,
    );
  }

  const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: arn }));
  const parsed = JSON.parse(res.SecretString ?? "{}") as Partial<NestRcOauthCredentials>;
  const clientId = parsed.clientId?.trim() ?? "";
  const clientSecret = parsed.clientSecret?.trim() ?? "";
  const projectId = parsed.projectId?.trim() ?? "";
  if (!clientId || !clientSecret || !projectId) {
    cachedRcOauth = null;
    throw new RCError(
      "Citizen Nest enrollment secret is incomplete (need clientId, clientSecret, projectId).",
      503,
    );
  }
  cachedRcOauth = { clientId, clientSecret, projectId };
  return cachedRcOauth;
}

async function exchangeAuthorizationCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: nestRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new RCError(
      `Token exchange failed: ${json.error_description ?? json.error ?? "unknown"}`,
      502,
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? "",
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

function partnerConnectUrl(projectId: string, clientId: string, nonce: string): string {
  const params = new URLSearchParams({
    redirect_uri: nestRedirectUri(),
    access_type: "offline",
    prompt: "consent",
    client_id: clientId,
    response_type: "code",
    scope: SDM_SCOPE,
    state: nonce,
  });
  return `${GOOGLE_AUTH_BASE}/${encodeURIComponent(projectId)}/auth?${params.toString()}`;
}

export async function nestBuildOAuthUrl(
  agencyId: string,
  projectId: string,
  clientId: string,
  clientSecret: string,
): Promise<{ oauthUrl: string; state: string }> {
  if (!clientSecret?.trim()) {
    throw new RCError("clientSecret is required to complete Nest OAuth linking", 400);
  }

  const nonce = randomUUID().replace(/-/g, "");
  const ttl = Math.floor(Date.now() / 1000) + STATE_TTL_S;
  const { blob: encryptedClientSecret, keyArn } = await encryptSecret(clientSecret.trim());
  const trimmedProject = projectId.trim();
  const trimmedClient = clientId.trim();

  await putOAuthState({
    nonce,
    kind: "agency",
    agencyId,
    projectId: trimmedProject,
    clientId: trimmedClient,
    encryptedClientSecret,
    encryptionKeyArn: keyArn,
    returnUrl: nestAccountLinkUrl(),
    ttl,
  });

  return {
    oauthUrl: partnerConnectUrl(trimmedProject, trimmedClient, nonce),
    state: nonce,
  };
}

export async function nestBuildCitizenOAuthUrl(input: {
  agencyId: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  email?: string;
}): Promise<{ oauthUrl: string; state: string }> {
  const creds = await getNestRcOauthCredentials();
  const nonce = randomUUID().replace(/-/g, "");
  const ttl = Math.floor(Date.now() / 1000) + STATE_TTL_S;

  await putOAuthState({
    nonce,
    kind: "citizen",
    agencyId: input.agencyId,
    projectId: creds.projectId,
    clientId: creds.clientId,
    phone: input.phone,
    address: input.address,
    lat: input.lat,
    lng: input.lng,
    email: input.email,
    returnUrl: nestCitizenLinkUrl(),
    ttl,
  });

  return {
    oauthUrl: partnerConnectUrl(creds.projectId, creds.clientId, nonce),
    state: nonce,
  };
}

export type NestCallbackResult = {
  agencyId: string;
  kind: NestOAuthKind;
  returnUrl: string;
};

export async function nestHandleCallback(code: string, state: string): Promise<NestCallbackResult> {
  const stateRecord = await getAndDeleteOAuthState(state);
  if (!stateRecord) {
    throw new RCError("Invalid or expired OAuth state", 400);
  }

  const kind: NestOAuthKind = stateRecord.kind === "citizen" ? "citizen" : "agency";

  if (kind === "citizen") {
    const creds = await getNestRcOauthCredentials();
    const tokens = await exchangeAuthorizationCode({
      code,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const now = new Date().toISOString();
    await putCitizenAccount({
      accountId: randomUUID(),
      agencyId: stateRecord.agencyId,
      phone: stateRecord.phone ?? "",
      email: stateRecord.email,
      lat: Number(stateRecord.lat),
      lng: Number(stateRecord.lng),
      address: stateRecord.address ?? "",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt,
      projectId: creds.projectId,
      registeredAt: now,
      lastRefreshedAt: now,
      active: true,
    });
    return {
      agencyId: stateRecord.agencyId,
      kind,
      returnUrl: stateRecord.returnUrl || nestCitizenLinkUrl(),
    };
  }

  if (!stateRecord.encryptedClientSecret) {
    throw new RCError("No pending credentials found for agency — restart the link flow", 400);
  }

  const clientSecret = await decryptSecret(stateRecord.encryptedClientSecret);
  const tokens = await exchangeAuthorizationCode({
    code,
    clientId: stateRecord.clientId,
    clientSecret,
  });

  await putNestToken({
    agencyId: stateRecord.agencyId,
    projectId: stateRecord.projectId,
    clientId: stateRecord.clientId,
    encryptedClientSecret: stateRecord.encryptedClientSecret,
    encryptionKeyArn: stateRecord.encryptionKeyArn ?? env.nestKmsKeyArn,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    linkedAt: new Date().toISOString(),
  });

  return {
    agencyId: stateRecord.agencyId,
    kind,
    returnUrl: stateRecord.returnUrl || nestAccountLinkUrl(),
  };
}

export async function nestRefreshAgencyToken(agencyId: string): Promise<string> {
  const record = await getNestToken(agencyId);
  if (!record?.refreshToken) {
    throw new RCError("No refresh token available — re-link Nest account", 401);
  }
  if (!record.encryptedClientSecret) {
    throw new RCError("Nest client secret missing — re-link Nest account", 401);
  }

  const clientSecret = await decryptSecret(record.encryptedClientSecret);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: record.clientId,
      client_secret: clientSecret,
      refresh_token: record.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new RCError(
      `Token refresh failed: ${json.error_description ?? json.error ?? "unknown"}`,
      502,
    );
  }

  const expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000;
  await updateNestAccessToken(agencyId, json.access_token, expiresAt, json.refresh_token);
  return json.access_token;
}
