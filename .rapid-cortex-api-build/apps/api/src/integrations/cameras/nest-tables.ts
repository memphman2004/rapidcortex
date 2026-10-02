/**
 * Google Nest SDM — DynamoDB access.
 *
 * Four tables:
 *   nest-tokens           — agency OAuth tokens (access + refresh per agencyId)
 *   nest-oauth-state      — short-lived CSRF nonces (TTL 10 min, single-use)
 *   nest-consent          — citizen consent lifecycle (GSI token-hash + agency-incident)
 *   nest-citizen-accounts — homeowner Nest tokens + lat/lng (GSI agency-index)
 *
 * Every Query/Get is agency-scoped. Citizen proximity uses GSI `agency-index`
 * then in-memory bounding-box + haversine — never Scan.
 *
 * @module integrations/cameras/nest-tables
 */

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

export type NestAgencyToken = {
  agencyId: string;
  projectId: string;
  clientId: string;
  encryptedClientSecret: string;
  encryptionKeyArn: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  linkedAt: string;
};

export type NestOAuthKind = "agency" | "citizen";

export type NestOAuthState = {
  nonce: string;
  kind: NestOAuthKind;
  agencyId: string;
  projectId: string;
  clientId: string;
  encryptedClientSecret?: string;
  encryptionKeyArn?: string;
  phone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  email?: string;
  returnUrl?: string;
  ttl: number;
};

export type NestConsentStatus = "SENT" | "DRAFT" | "NO_PHONE" | "APPROVED" | "DECLINED" | "EXPIRED";

export type NestConsentRequest = {
  requestId: string;
  tokenHash: string;
  agencyId: string;
  incidentId: string;
  agencyIncidentId: string;
  citizenAccountId: string;
  deviceId: string;
  deviceName: string;
  requestStatus: NestConsentStatus;
  requestedDurationMinutes: 10 | 30 | 60 | 120;
  expiresAt: string;
  createdAt: string;
  resolvedAt?: string;
  ttl?: number;
};

export type NestCitizenAccount = {
  accountId: string;
  agencyId: string;
  phone: string;
  email?: string;
  lat: number;
  lng: number;
  address: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  projectId: string;
  registeredAt: string;
  lastRefreshedAt: string;
  active: boolean;
};

export function nestAgencyIncidentId(agencyId: string, incidentId: string): string {
  return `${agencyId}#${incidentId}`;
}

function tokensTable(): string {
  const n = env.nestTokensTableName;
  if (!n) throw new Error("NEST_TOKENS_TABLE not configured");
  return n;
}

function stateTable(): string {
  const n = env.nestOauthStateTableName;
  if (!n) throw new Error("NEST_OAUTH_STATE_TABLE not configured");
  return n;
}

function consentTable(): string {
  const n = env.nestConsentTableName;
  if (!n) throw new Error("NEST_CONSENT_TABLE not configured");
  return n;
}

function citizensTable(): string {
  const n = env.nestCitizenAccountsTableName;
  if (!n) throw new Error("NEST_CITIZEN_ACCOUNTS_TABLE not configured");
  return n;
}

// ── Agency tokens ─────────────────────────────────────────────────────────────

export async function putNestToken(token: NestAgencyToken): Promise<void> {
  await ddb.send(new PutCommand({ TableName: tokensTable(), Item: token }));
}

export async function getNestToken(agencyId: string): Promise<NestAgencyToken | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: tokensTable(),
      Key: { agencyId },
    }),
  );
  return (res.Item as NestAgencyToken | undefined) ?? null;
}

export async function updateNestAccessToken(
  agencyId: string,
  accessToken: string,
  expiresAt: number,
  refreshToken?: string,
): Promise<void> {
  const names: Record<string, string> = {
    "#accessToken": "accessToken",
    "#expiresAt": "expiresAt",
  };
  const values: Record<string, unknown> = {
    ":accessToken": accessToken,
    ":expiresAt": expiresAt,
  };
  let update = "SET #accessToken = :accessToken, #expiresAt = :expiresAt";
  if (refreshToken) {
    names["#refreshToken"] = "refreshToken";
    values[":refreshToken"] = refreshToken;
    update += ", #refreshToken = :refreshToken";
  }
  await ddb.send(
    new UpdateCommand({
      TableName: tokensTable(),
      Key: { agencyId },
      UpdateExpression: update,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function deleteNestToken(agencyId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: tokensTable(),
      Key: { agencyId },
    }),
  );
}

// ── OAuth state (single-use nonce) ────────────────────────────────────────────

export async function putOAuthState(state: NestOAuthState): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: stateTable(),
      Item: state,
    }),
  );
}

export async function getAndDeleteOAuthState(nonce: string): Promise<NestOAuthState | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: stateTable(),
      Key: { nonce },
    }),
  );
  if (!res.Item) return null;

  await ddb.send(
    new DeleteCommand({
      TableName: stateTable(),
      Key: { nonce },
    }),
  );

  const record = res.Item as NestOAuthState;
  if (record.ttl < Math.floor(Date.now() / 1000)) return null;
  return record;
}

// ── Consent requests ──────────────────────────────────────────────────────────

export async function putNestConsentRequest(r: NestConsentRequest): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: consentTable(),
      Item: r,
    }),
  );
}

export async function getNestConsentByTokenHash(
  tokenHash: string,
): Promise<NestConsentRequest | null> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: consentTable(),
      IndexName: "token-hash-index",
      KeyConditionExpression: "tokenHash = :th",
      ExpressionAttributeValues: { ":th": tokenHash },
      Limit: 1,
    }),
  );
  return (res.Items?.[0] as NestConsentRequest | undefined) ?? null;
}

export async function listNestConsentForIncident(
  agencyId: string,
  incidentId: string,
): Promise<NestConsentRequest[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: consentTable(),
      IndexName: "agency-incident-index",
      KeyConditionExpression: "agencyIncidentId = :pk",
      ExpressionAttributeValues: { ":pk": nestAgencyIncidentId(agencyId, incidentId) },
    }),
  );
  return ((res.Items ?? []) as NestConsentRequest[]).filter((r) => r.agencyId === agencyId);
}

export async function updateNestConsentStatus(
  requestId: string,
  status: NestConsentRequest["requestStatus"],
  resolvedAt: string,
): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: consentTable(),
      Key: { requestId },
      UpdateExpression: "SET requestStatus = :s, resolvedAt = :r",
      ExpressionAttributeValues: { ":s": status, ":r": resolvedAt },
    }),
  );
}

// ── Citizen accounts ──────────────────────────────────────────────────────────

export async function putCitizenAccount(account: NestCitizenAccount): Promise<void> {
  await ddb.send(new PutCommand({ TableName: citizensTable(), Item: account }));
}

export async function getCitizenAccount(accountId: string): Promise<NestCitizenAccount | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: citizensTable(),
      Key: { accountId },
    }),
  );
  return (res.Item as NestCitizenAccount | undefined) ?? null;
}

export async function updateCitizenTokens(
  accountId: string,
  accessToken: string,
  tokenExpiresAt: number,
  refreshToken?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const names: Record<string, string> = {
    "#accessToken": "accessToken",
    "#tokenExpiresAt": "tokenExpiresAt",
    "#lastRefreshedAt": "lastRefreshedAt",
  };
  const values: Record<string, unknown> = {
    ":accessToken": accessToken,
    ":tokenExpiresAt": tokenExpiresAt,
    ":lastRefreshedAt": now,
  };
  let update =
    "SET #accessToken = :accessToken, #tokenExpiresAt = :tokenExpiresAt, #lastRefreshedAt = :lastRefreshedAt";
  if (refreshToken) {
    names["#refreshToken"] = "refreshToken";
    values[":refreshToken"] = refreshToken;
    update += ", #refreshToken = :refreshToken";
  }
  await ddb.send(
    new UpdateCommand({
      TableName: citizensTable(),
      Key: { accountId },
      UpdateExpression: update,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function listCitizenAccountsForAgency(agencyId: string): Promise<NestCitizenAccount[]> {
  const items: NestCitizenAccount[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: citizensTable(),
        IndexName: "agency-index",
        KeyConditionExpression: "agencyId = :ag",
        ExpressionAttributeValues: { ":ag": agencyId },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );
    items.push(...((res.Items ?? []) as NestCitizenAccount[]));
    exclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (exclusiveStartKey);
  return items.filter((a) => a.agencyId === agencyId && a.active !== false);
}

/**
 * Agency-scoped citizen accounts inside a lat/lng bounding box.
 * Exact haversine filtering belongs in the service layer.
 */
export async function queryCitizenAccountsNear(
  lat: number,
  lng: number,
  agencyId: string,
  radiusMeters: number,
): Promise<NestCitizenAccount[]> {
  const degBuffer = (radiusMeters / 111_000) * 1.2;
  const latMin = lat - degBuffer;
  const latMax = lat + degBuffer;
  const lngMin = lng - degBuffer;
  const lngMax = lng + degBuffer;
  const all = await listCitizenAccountsForAgency(agencyId);
  return all.filter(
    (a) => a.lat >= latMin && a.lat <= latMax && a.lng >= lngMin && a.lng <= lngMax,
  );
}
