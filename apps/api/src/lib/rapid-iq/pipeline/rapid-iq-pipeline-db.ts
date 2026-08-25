/**
 * DynamoDB access for Rapid IQ pipeline signals
 * (table: RAPID_IQ_PIPELINE_SIGNALS_TABLE — not RAPID_IQ_SIGNALS_TABLE).
 */

import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import type {
  RapidIqAgencyContact,
  RapidIqAgencyProfile,
  RapidIqPipelineSignal,
  RapidIqPipelineSignalStatus,
  RapidIqProcurementStage,
} from "rapid-cortex-shared";
import { env } from "../../env.js";
import { ddb } from "../../../repositories/baseRepository.js";

function table(): string {
  const t = env.rapidIqPipelineSignalsTable?.trim() || process.env.RAPID_IQ_PIPELINE_SIGNALS_TABLE?.trim();
  if (!t) throw new Error("RAPID_IQ_PIPELINE_SIGNALS_TABLE_NOT_CONFIGURED");
  return t;
}

function pk(signalId: string) {
  return `SIGNAL#${signalId}`;
}

function gsi1pk(status: RapidIqPipelineSignalStatus) {
  return `STATUS#${status}`;
}

function gsi1sk(fitScore: number, signalDate: string) {
  return `${String(fitScore).padStart(3, "0")}#${signalDate}`;
}

/** SHA-256 fingerprint of title + snippet prefix for dedup (hex, 32 chars). */
export function contentHash(title: string, snippet: string): string {
  return createHash("sha256")
    .update(`${title}|${snippet.slice(0, 500)}`)
    .digest("hex")
    .slice(0, 32);
}

export async function getSignalIdByHash(hash: string): Promise<string | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: `HASH#${hash}`, sk: "META" },
    }),
  );
  const id = res.Item?.signalId;
  return typeof id === "string" && id.trim() ? id : null;
}

export async function signalExistsByHash(hash: string): Promise<boolean> {
  return (await getSignalIdByHash(hash)) != null;
}

export async function reserveHash(hash: string, signalId: string): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: `HASH#${hash}`,
        sk: "META",
        signalId,
        createdAt: new Date().toISOString(),
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );
}

export async function putSignal(signal: RapidIqPipelineSignal): Promise<void> {
  const item = {
    ...signal,
    pk: pk(signal.signalId),
    sk: "META",
    gsi1pk: gsi1pk(signal.status),
    gsi1sk: gsi1sk(signal.fitScore, signal.signalDate),
    gsi2pk: `SOURCE#${signal.sourceId}`,
    gsi2sk: signal.signalDate,
  };
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: item,
    }),
  );
}

function stripDynamoKeys(obj: Record<string, unknown>): RapidIqPipelineSignal {
  const {
    pk: _pk,
    sk: _sk,
    gsi1pk: _g1,
    gsi1sk: _g1s,
    gsi2pk: _g2,
    gsi2sk: _g2s,
    ...rest
  } = obj;
  void _pk;
  void _sk;
  void _g1;
  void _g1s;
  void _g2;
  void _g2s;
  return rest as RapidIqPipelineSignal;
}

export async function getSignal(signalId: string): Promise<RapidIqPipelineSignal | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: pk(signalId), sk: "META" },
    }),
  );
  if (!res.Item) return null;
  return stripDynamoKeys(res.Item as Record<string, unknown>);
}

export async function listSignalsByStatus(
  status: RapidIqPipelineSignalStatus,
  limit = 50,
): Promise<RapidIqPipelineSignal[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: table(),
      IndexName: "gsi1-status-score",
      KeyConditionExpression: "gsi1pk = :pk",
      ExpressionAttributeValues: { ":pk": gsi1pk(status) },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (res.Items ?? []).map((i) => stripDynamoKeys(i as Record<string, unknown>));
}

export async function listAllSignals(limit = 100): Promise<RapidIqPipelineSignal[]> {
  const statuses: RapidIqPipelineSignalStatus[] = ["new", "reviewed", "pushed", "dismissed"];
  const per = Math.max(1, Math.ceil(limit / statuses.length));
  const results = await Promise.all(statuses.map((s) => listSignalsByStatus(s, per)));
  const flat = results.flat();
  flat.sort((a, b) => {
    if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
    return b.signalDate.localeCompare(a.signalDate);
  });
  return flat.slice(0, limit);
}

export async function updateSignalStatus(
  signalId: string,
  status: RapidIqPipelineSignalStatus,
  extra?: {
    reviewedBy?: string;
    crmLeadId?: string;
  },
): Promise<RapidIqPipelineSignal> {
  const now = new Date().toISOString();
  const current = await getSignal(signalId);
  if (!current) throw new Error(`Signal ${signalId} not found`);

  const names: Record<string, string> = { "#status": "status" };
  const values: Record<string, unknown> = {
    ":status": status,
    ":gsi1pk": gsi1pk(status),
    ":gsi1sk": gsi1sk(current.fitScore, current.signalDate),
    ":now": now,
  };
  let expr =
    "SET #status = :status, gsi1pk = :gsi1pk, gsi1sk = :gsi1sk, reviewedAt = :now";

  if (extra?.reviewedBy) {
    expr += ", reviewedBy = :reviewedBy";
    values[":reviewedBy"] = extra.reviewedBy;
  }
  if (extra?.crmLeadId) {
    expr += ", crmLeadId = :crmLeadId, pushedAt = :pushedAt";
    values[":crmLeadId"] = extra.crmLeadId;
    values[":pushedAt"] = now;
  }

  await ddb.send(
    new UpdateCommand({
      TableName: table(),
      Key: { pk: pk(signalId), sk: "META" },
      UpdateExpression: expr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );

  const updated = await getSignal(signalId);
  if (!updated) throw new Error(`Signal ${signalId} missing after update`);
  return updated;
}

const AGENCY_PROFILE_GSI2PK = "AGENCY_PROFILE";

function agencyPk(agencyId: string) {
  return `AGENCY#${agencyId}`;
}

function stripAgencyKeys(obj: Record<string, unknown>): RapidIqAgencyProfile {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g1s, gsi2pk: _g2, gsi2sk: _g2s, ...rest } = obj;
  void _pk;
  void _sk;
  void _g1;
  void _g1s;
  void _g2;
  void _g2s;
  return rest as RapidIqAgencyProfile;
}

function stripContactKeys(obj: Record<string, unknown>): RapidIqAgencyContact {
  const { pk: _pk, sk: _sk, gsi1pk: _g1, gsi1sk: _g1s, gsi2pk: _g2, gsi2sk: _g2s, ...rest } = obj;
  void _pk;
  void _sk;
  void _g1;
  void _g1s;
  void _g2;
  void _g2s;
  return rest as RapidIqAgencyContact;
}

export async function updateSignalFields(
  signalId: string,
  fields: {
    status?: RapidIqPipelineSignalStatus;
    procurementStage?: RapidIqProcurementStage;
    agencyProfileId?: string;
    recommendedAction?: string;
  },
): Promise<RapidIqPipelineSignal> {
  const current = await getSignal(signalId);
  if (!current) throw new Error(`Signal ${signalId} not found`);
  const now = new Date().toISOString();
  const status = fields.status ?? current.status;
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {
    ":gsi1pk": gsi1pk(status),
    ":gsi1sk": gsi1sk(current.fitScore, current.signalDate),
    ":now": now,
  };
  const sets = ["gsi1pk = :gsi1pk", "gsi1sk = :gsi1sk"];

  if (fields.status) {
    names["#status"] = "status";
    values[":status"] = fields.status;
    sets.push("#status = :status");
    sets.push("reviewedAt = :now");
  }
  if (fields.procurementStage) {
    names["#stage"] = "procurementStage";
    values[":stage"] = fields.procurementStage;
    sets.push("#stage = :stage");
  }
  if (fields.agencyProfileId) {
    values[":agencyProfileId"] = fields.agencyProfileId;
    sets.push("agencyProfileId = :agencyProfileId");
  }
  if (fields.recommendedAction) {
    values[":recommendedAction"] = fields.recommendedAction;
    sets.push("recommendedAction = :recommendedAction");
  }

  await ddb.send(
    new UpdateCommand({
      TableName: table(),
      Key: { pk: pk(signalId), sk: "META" },
      UpdateExpression: `SET ${sets.join(", ")}`,
      ExpressionAttributeValues: values,
      ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
    }),
  );
  const updated = await getSignal(signalId);
  if (!updated) throw new Error(`Signal ${signalId} missing after update`);
  return updated;
}

export async function putAgencyProfile(profile: RapidIqAgencyProfile): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...profile,
        pk: agencyPk(profile.agencyId),
        sk: "PROFILE",
        gsi2pk: AGENCY_PROFILE_GSI2PK,
        gsi2sk: `${String(profile.combinedScore).padStart(3, "0")}#${profile.agencyId}`,
      },
    }),
  );
}

export async function getAgencyProfile(agencyId: string): Promise<RapidIqAgencyProfile | null> {
  const res = await ddb.send(
    new GetCommand({
      TableName: table(),
      Key: { pk: agencyPk(agencyId), sk: "PROFILE" },
    }),
  );
  if (!res.Item) return null;
  return stripAgencyKeys(res.Item as Record<string, unknown>);
}

export async function listAgencyProfiles(limit = 200): Promise<RapidIqAgencyProfile[]> {
  const items: RapidIqAgencyProfile[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "gsi2-source-date",
        KeyConditionExpression: "gsi2pk = :pk",
        ExpressionAttributeValues: { ":pk": AGENCY_PROFILE_GSI2PK },
        ScanIndexForward: false,
        Limit: Math.min(100, limit - items.length),
        ExclusiveStartKey: startKey,
      }),
    );
    for (const item of res.Items ?? []) {
      items.push(stripAgencyKeys(item as Record<string, unknown>));
    }
    startKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (startKey && items.length < limit);
  return items;
}

export async function putAgencySignalLink(
  agencyId: string,
  signal: {
    signalId: string;
    rawTitle: string;
    signalDate: string;
    sourceUrl: string;
    combinedScore?: number;
    fitScore: number;
  },
): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        pk: agencyPk(agencyId),
        sk: `SIGNAL#${signal.signalId}`,
        signalId: signal.signalId,
        rawTitle: signal.rawTitle,
        signalDate: signal.signalDate,
        sourceUrl: signal.sourceUrl,
        combinedScore: signal.combinedScore ?? signal.fitScore,
      },
    }),
  );
}

export async function listAgencySignalLinks(
  agencyId: string,
): Promise<Array<{ signalId: string; signalDate?: string; combinedScore?: number }>> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": agencyPk(agencyId), ":sk": "SIGNAL#" },
      Limit: 100,
    }),
  );
  return (res.Items ?? []).map((item) => ({
    signalId: String(item.signalId ?? String(item.sk ?? "").replace(/^SIGNAL#/, "")),
    signalDate: typeof item.signalDate === "string" ? item.signalDate : undefined,
    combinedScore: typeof item.combinedScore === "number" ? item.combinedScore : undefined,
  }));
}

export async function putAgencyContact(contact: RapidIqAgencyContact): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: table(),
      Item: {
        ...contact,
        pk: agencyPk(contact.agencyId),
        sk: `CONTACT#${contact.contactId}`,
      },
    }),
  );
}

export async function listAgencyContacts(agencyId: string): Promise<RapidIqAgencyContact[]> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: table(),
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: { ":pk": agencyPk(agencyId), ":sk": "CONTACT#" },
      Limit: 50,
    }),
  );
  return (res.Items ?? []).map((i) => stripContactKeys(i as Record<string, unknown>));
}

export async function listSignalsForResearch(limit = 200): Promise<RapidIqPipelineSignal[]> {
  return listAllSignals(limit);
}
