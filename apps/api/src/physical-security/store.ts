import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { PhysicalSecurityEvent } from "rapid-cortex-shared";
import { ddb } from "../repositories/baseRepository.js";
import { env } from "../lib/env.js";

function table(): string {
  const t = env.physicalSecurityTable;
  if (!t) throw new Error("PHYSICAL_SECURITY_TABLE is not configured");
  return t;
}

export const PHYS_SK = {
  event: (eventId: string) => `EVT#${eventId}`,
  zoneBadge: (zoneCode: string) => `ZONE#${zoneCode.toUpperCase()}`,
};

export const physicalSecurityStore = {
  async putEvent(event: PhysicalSecurityEvent): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          ...event,
          agencyId: event.agencyId,
          sk: PHYS_SK.event(event.eventId),
        },
      }),
    );
  },

  async listRecentEvents(agencyId: string, limit = 50): Promise<PhysicalSecurityEvent[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "EVT#" },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as PhysicalSecurityEvent[];
  },

  async putZoneBadge(params: {
    agencyId: string;
    zoneCode: string;
    mapBadge: string;
    eventId: string;
    updatedAt: string;
  }): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: table(),
        Item: {
          agencyId: params.agencyId,
          sk: PHYS_SK.zoneBadge(params.zoneCode),
          zoneCode: params.zoneCode,
          mapBadge: params.mapBadge,
          eventId: params.eventId,
          updatedAt: params.updatedAt,
        },
      }),
    );
  },

  async listZoneBadges(
    agencyId: string,
  ): Promise<Array<{ zoneCode: string; mapBadge: string; updatedAt: string }>> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: table(),
        KeyConditionExpression: "agencyId = :a AND begins_with(sk, :p)",
        ExpressionAttributeValues: { ":a": agencyId, ":p": "ZONE#" },
      }),
    );
    return (out.Items ?? []) as Array<{ zoneCode: string; mapBadge: string; updatedAt: string }>;
  },

  async getEvent(agencyId: string, eventId: string): Promise<PhysicalSecurityEvent | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: table(),
        Key: { agencyId, sk: PHYS_SK.event(eventId) },
      }),
    );
    return (out.Item as PhysicalSecurityEvent | undefined) ?? null;
  },
};
