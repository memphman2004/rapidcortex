import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { RingHomeownerParticipantRecord } from "rapid-cortex-integrations/ring";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

const AGENCY_INDEX = "agencyId-index";
const STATE_INDEX = "state-index";

function participantsTable(): string {
  const t = env.ringHomeownerParticipantsTable?.trim();
  if (!t) throw new Error("RING_TABLE_HOMEOWNER_PARTICIPANTS_NOT_CONFIGURED");
  return t;
}

export class RingHomeownerParticipantRepository {
  async getByHomeownerId(homeownerId: string): Promise<RingHomeownerParticipantRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: participantsTable(),
        Key: { homeownerId },
      }),
    );
    if (!out.Item) return null;
    return out.Item as RingHomeownerParticipantRecord;
  }

  async upsert(record: RingHomeownerParticipantRecord): Promise<void> {
    // Sparse GSIs: only include agencyId / state when set so unmatched rows stay queryable by state.
    const item: Record<string, unknown> = {
      homeownerId: record.homeownerId,
      ringAccountId: record.ringAccountId,
      deviceCount: record.deviceCount,
      deviceIds: record.deviceIds,
      secretsManagerTokenKey: record.secretsManagerTokenKey,
      consentGiven: record.consentGiven,
      registeredAt: record.registeredAt,
      updatedAt: record.updatedAt,
    };
    if (record.agencyId) item.agencyId = record.agencyId;
    if (record.state) item.state = record.state;
    if (record.name) item.name = record.name;
    if (record.phone) item.phone = record.phone;
    if (record.email) item.email = record.email;
    if (typeof record.ttl === "number") item.ttl = record.ttl;

    await ddb.send(
      new PutCommand({
        TableName: participantsTable(),
        Item: item,
      }),
    );
  }

  async listByAgencyId(agencyId: string): Promise<RingHomeownerParticipantRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: participantsTable(),
        IndexName: AGENCY_INDEX,
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": agencyId },
      }),
    );
    return (out.Items ?? []) as RingHomeownerParticipantRecord[];
  }

  async listByState(state: string): Promise<RingHomeownerParticipantRecord[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: participantsTable(),
        IndexName: STATE_INDEX,
        KeyConditionExpression: "#s = :state",
        ExpressionAttributeNames: { "#s": "state" },
        ExpressionAttributeValues: { ":state": state },
      }),
    );
    return (out.Items ?? []) as RingHomeownerParticipantRecord[];
  }
}
