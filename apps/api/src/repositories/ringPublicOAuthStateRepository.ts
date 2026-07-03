import { randomUUID } from "node:crypto";
import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

const SENTINEL_PARTITION = "__ring_public_oauth_state__";
const MANAGE_TOKEN_PARTITION = "__ring_manage_token__";
const ITEM_TYPE = "ring_public_oauth_state";
const MANAGE_TOKEN_TYPE = "ring_manage_token";
const TTL_SECONDS = 600;
const MANAGE_TOKEN_TTL_SECONDS = 300;

export type RingOAuthMode = "link" | "manage";

export type RingPublicOAuthStateRecord = {
  state: string;
  agencyId: string;
  createdAt: string;
  mode: RingOAuthMode;
  /** Ring Appstore return URL — redirect here after successful link so Ring updates its UI. */
  ringReturnUrl?: string | null;
};

export type RingManageTokenRecord = {
  token: string;
  ringAccountId: string;
  agencyId: string;
};

function requestsTable(): string {
  const t = env.ringRequestsTable?.trim();
  if (!t) throw new Error("RING_TABLE_REQUESTS_NOT_CONFIGURED");
  return t;
}

export class RingPublicOAuthStateRepository {
  async saveState(
    state: string,
    agencyId: string,
    mode: RingOAuthMode = "link",
    ringReturnUrl?: string | null,
  ): Promise<void> {
    const now = new Date();
    const ttl = Math.floor(now.getTime() / 1000) + TTL_SECONDS;
    await ddb.send(
      new PutCommand({
        TableName: requestsTable(),
        Item: {
          agencyIncidentKey: SENTINEL_PARTITION,
          requestId: state,
          itemType: ITEM_TYPE,
          state,
          agencyId,
          mode,
          createdAt: now.toISOString(),
          ttl,
          ...(ringReturnUrl ? { ringReturnUrl } : {}),
        },
      }),
    );
  }

  /** Load and delete the state row (single-use). */
  async takeState(state: string): Promise<RingPublicOAuthStateRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: requestsTable(),
        Key: { agencyIncidentKey: SENTINEL_PARTITION, requestId: state },
      }),
    );
    if (!out.Item || out.Item.itemType !== ITEM_TYPE) return null;

    await ddb.send(
      new DeleteCommand({
        TableName: requestsTable(),
        Key: { agencyIncidentKey: SENTINEL_PARTITION, requestId: state },
      }),
    );

    const agencyId = String(out.Item.agencyId ?? "");
    const createdAt = String(out.Item.createdAt ?? "");
    const rawMode = String(out.Item.mode ?? "link");
    const mode: RingOAuthMode = rawMode === "manage" ? "manage" : "link";
    const ringReturnUrl = typeof out.Item.ringReturnUrl === "string" ? out.Item.ringReturnUrl : null;
    if (!agencyId || !createdAt) return null;
    return { state, agencyId, createdAt, mode, ringReturnUrl };
  }

  /** Persist a short-lived manage token after a successful manage OAuth round trip. */
  async saveManageToken(ringAccountId: string, agencyId: string): Promise<string> {
    const token = randomUUID();
    const ttl = Math.floor(Date.now() / 1000) + MANAGE_TOKEN_TTL_SECONDS;
    await ddb.send(
      new PutCommand({
        TableName: requestsTable(),
        Item: {
          agencyIncidentKey: MANAGE_TOKEN_PARTITION,
          requestId: token,
          itemType: MANAGE_TOKEN_TYPE,
          token,
          ringAccountId,
          agencyId,
          createdAt: new Date().toISOString(),
          ttl,
        },
      }),
    );
    return token;
  }

  /** Load and delete the manage token (single-use). */
  async takeManageToken(token: string): Promise<RingManageTokenRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: requestsTable(),
        Key: { agencyIncidentKey: MANAGE_TOKEN_PARTITION, requestId: token },
      }),
    );
    if (!out.Item || out.Item.itemType !== MANAGE_TOKEN_TYPE) return null;

    await ddb.send(
      new DeleteCommand({
        TableName: requestsTable(),
        Key: { agencyIncidentKey: MANAGE_TOKEN_PARTITION, requestId: token },
      }),
    );

    const ringAccountId = String(out.Item.ringAccountId ?? "");
    const agencyId = String(out.Item.agencyId ?? "");
    if (!ringAccountId || !agencyId) return null;
    return { token, ringAccountId, agencyId };
  }
}
