import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PreArrivalSession } from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

function table(): string {
  const t = env.preArrivalSessionsTable;
  if (!t) throw new Error("PRE_ARRIVAL_TABLE_NOT_CONFIGURED");
  return t;
}

/** Dynamo item — PK sessionToken for public + dispatcher lookup; agencyId always checked. */
export type PreArrivalDdbItem = PreArrivalSession & {
  pk: string; // AGENCY#{agencyId}
  sk: string; // SESSION#{sessionToken}
  gsi1pk: string; // INCIDENT#{incidentId}
  gsi1sk: string; // SESSION#{sessionToken}
};

function toItem(session: PreArrivalSession): PreArrivalDdbItem {
  return {
    ...session,
    pk: `AGENCY#${session.agencyId}`,
    sk: `SESSION#${session.sessionToken}`,
    gsi1pk: `INCIDENT#${session.incidentId}`,
    gsi1sk: `SESSION#${session.sessionToken}`,
  };
}

export class PreArrivalSessionStore {
  async put(session: PreArrivalSession): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: toItem(session),
      }),
    );
  }

  async getByToken(sessionToken: string): Promise<PreArrivalSession | null> {
    // Query GSI isn't needed — we also store sessionToken as a top-level attribute and
    // use a sparse secondary lookup via Scan-free Get on a dedicated token key pattern:
    // Items are keyed pk/sk; public path uses ByToken GSI (sessionToken HASH).
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "ByToken",
        KeyConditionExpression: "sessionToken = :t",
        ExpressionAttributeValues: { ":t": sessionToken },
        Limit: 1,
      }),
    );
    const item = (r.Items?.[0] as PreArrivalDdbItem | undefined) ?? null;
    return item ? stripKeys(item) : null;
  }

  async getForAgency(sessionToken: string, agencyId: string): Promise<PreArrivalSession | null> {
    const r = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { pk: `AGENCY#${agencyId}`, sk: `SESSION#${sessionToken}` },
      }),
    );
    const item = (r.Item as PreArrivalDdbItem | undefined) ?? null;
    if (!item || item.agencyId !== agencyId) return null;
    return stripKeys(item);
  }

  async getActiveByIncident(incidentId: string, agencyId?: string): Promise<PreArrivalSession | null> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "ByIncident",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": `INCIDENT#${incidentId}` },
        ScanIndexForward: false,
        Limit: 10,
      }),
    );
    const items = (r.Items as PreArrivalDdbItem[] | undefined) ?? [];
    for (const item of items) {
      if (agencyId && item.agencyId !== agencyId) continue;
      if (item.status === "terminated" || item.status === "ended" || item.status === "failed") continue;
      return stripKeys(item);
    }
    return null;
  }

  async listByIncident(incidentId: string, agencyId: string, limit = 25): Promise<PreArrivalSession[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "ByIncident",
        KeyConditionExpression: "gsi1pk = :p",
        ExpressionAttributeValues: { ":p": `INCIDENT#${incidentId}` },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    const items = (r.Items as PreArrivalDdbItem[] | undefined) ?? [];
    return items.filter((i) => i.agencyId === agencyId).map(stripKeys);
  }

  async updateFields(
    agencyId: string,
    sessionToken: string,
    updates: Record<string, unknown>,
  ): Promise<void> {
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    const parts: string[] = [];
    let i = 0;
    for (const [k, v] of Object.entries(updates)) {
      const nk = `#k${i}`;
      const vk = `:v${i}`;
      names[nk] = k;
      values[vk] = v;
      parts.push(`${nk} = ${vk}`);
      i += 1;
    }
    if (!parts.length) return;
    values[":agencyGuard"] = agencyId;
    await ddb.send(
      new UpdateCommand({
        TableName: table(),
        Key: { pk: `AGENCY#${agencyId}`, sk: `SESSION#${sessionToken}` },
        UpdateExpression: `SET ${parts.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: "attribute_exists(pk) AND agencyId = :agencyGuard",
      }),
    );
  }
}

function stripKeys(item: PreArrivalDdbItem): PreArrivalSession {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g2, ...rest } = item;
  return rest;
}

export const preArrivalSessionStore = new PreArrivalSessionStore();
