import { randomUUID } from "node:crypto";
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { ddb } from "../../repositories/baseRepository.js";

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

const NEST_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const NEST_TOKEN_URL = "https://oauth2.googleapis.com/token";
const NEST_SCOPE = "https://www.googleapis.com/auth/sdm.service";

let cachedNestClientSecret: string | null = null;

export class RCError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "RCError";
  }
}

function oauthTable(): string {
  const n = process.env.DYNAMODB_TABLE_OAUTH?.trim();
  if (!n) throw new RCError("DYNAMODB_TABLE_OAUTH not configured", 500);
  return n;
}

function tokensTable(): string {
  const n = process.env.DYNAMODB_TABLE_TOKENS?.trim();
  if (!n) throw new RCError("DYNAMODB_TABLE_TOKENS not configured", 500);
  return n;
}

export function nestRedirectUri(): string {
  return (
    process.env.NEST_REDIRECT_URI?.trim() ||
    "https://api.rapidcortex.us/api/cameras/providers/nest/callback"
  );
}

export function nestAccountLinkUrl(): string {
  return (
    process.env.NEST_ACCOUNT_LINK_URL?.trim() ||
    "https://app.rapidcortex.us/app/venue/MBS/cameras"
  );
}

export async function getNestClientSecret(): Promise<string> {
  if (cachedNestClientSecret) return cachedNestClientSecret;

  const res = await secretsClient.send(
    new GetSecretValueCommand({ SecretId: "rc/cameras/nest/oauth" }),
  );

  const parsed = JSON.parse(res.SecretString ?? "{}") as { clientSecret?: string };
  cachedNestClientSecret = parsed.clientSecret ?? "";

  if (!cachedNestClientSecret) {
    throw new RCError("Nest client secret not found in Secrets Manager", 500);
  }

  return cachedNestClientSecret;
}

export type NestOAuthStateRecord = {
  state: string;
  agencyId: string;
  projectId: string;
  clientId: string;
  createdAt: string;
  ttl: number;
};

export async function storeOAuthState(
  state: string,
  agencyId: string,
  data: { projectId: string; clientId: string },
): Promise<void> {
  const ttl = Math.floor(Date.now() / 1000) + 600;
  await ddb.send(
    new PutCommand({
      TableName: oauthTable(),
      Item: {
        state,
        agencyId,
        projectId: data.projectId,
        clientId: data.clientId,
        createdAt: new Date().toISOString(),
        ttl,
      },
    }),
  );
}

export async function loadOAuthState(state: string): Promise<NestOAuthStateRecord | null> {
  const out = await ddb.send(
    new GetCommand({
      TableName: oauthTable(),
      Key: { state },
    }),
  );
  return (out.Item as NestOAuthStateRecord | undefined) ?? null;
}

export async function deleteOAuthState(state: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: oauthTable(),
      Key: { state },
    }),
  );
}

export async function nestBuildOAuthUrl(
  agencyId: string,
  projectId: string,
  clientId: string,
): Promise<{ oauthUrl: string; state: string }> {
  const state = randomUUID();

  await storeOAuthState(state, agencyId, { projectId, clientId });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: nestRedirectUri(),
    response_type: "code",
    scope: NEST_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return { oauthUrl: `${NEST_OAUTH_BASE}?${params.toString()}`, state };
}

export type NestTokenRecord = {
  agencyId: string;
  provider: "nest";
  projectId: string;
  clientId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  updatedAt: string;
  createdAt: string;
};

export async function storeNestTokens(record: Omit<NestTokenRecord, "provider">): Promise<void> {
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: tokensTable(),
      Item: {
        ...record,
        provider: "nest",
        pk: `${record.agencyId}#nest`,
        updatedAt: now,
        createdAt: record.createdAt || now,
      },
    }),
  );
}

export async function nestHandleCallback(code: string, state: string): Promise<{ agencyId: string }> {
  const stored = await loadOAuthState(state);
  if (!stored) {
    throw new RCError("Invalid or expired OAuth state", 400);
  }

  const clientSecret = await getNestClientSecret();

  const body = new URLSearchParams({
    code,
    client_id: stored.clientId,
    client_secret: clientSecret,
    redirect_uri: nestRedirectUri(),
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(NEST_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new RCError(
      tokenJson.error_description ?? tokenJson.error ?? "Token exchange failed",
      502,
    );
  }

  const expiresAt = Date.now() + (tokenJson.expires_in ?? 3600) * 1000;

  await storeNestTokens({
    agencyId: stored.agencyId,
    projectId: stored.projectId,
    clientId: stored.clientId,
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresAt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await deleteOAuthState(state);

  return { agencyId: stored.agencyId };
}
