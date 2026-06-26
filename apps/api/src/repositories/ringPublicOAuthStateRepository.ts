import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

const SENTINEL_PARTITION = "__ring_public_oauth_state__";
const ITEM_TYPE = "ring_public_oauth_state";
const TTL_SECONDS = 600;

export type RingPublicOAuthStateRecord = {
  state: string;
  agencyId: string;
  createdAt: string;
};

function requestsTable(): string {
  const t = env.ringRequestsTable?.trim();
  if (!t) throw new Error("RING_TABLE_REQUESTS_NOT_CONFIGURED");
  return t;
}

export class RingPublicOAuthStateRepository {
  async saveState(state: string, agencyId: string): Promise<void> {
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
          createdAt: now.toISOString(),
          ttl,
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
    if (!agencyId || !createdAt) return null;
    return { state, agencyId, createdAt };
  }
}
