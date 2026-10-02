import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { TimelineEvent } from "rapid-cortex-shared";

export type TimelineEventRow = TimelineEvent & {
  sk: string;
};

function sortKey(timestamp: string, eventId: string): string {
  return `${timestamp}#${eventId}`;
}

export class IncidentTimelineRepository {
  private requireTable(): string {
    const t = env.incidentTimelineTable;
    if (!t) throw new Error("INCIDENT_TIMELINE_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(event: TimelineEvent): Promise<void> {
    const row: TimelineEventRow = { ...event, sk: sortKey(event.timestamp, event.eventId) };
    await ddb.send(
      new PutCommand({
        TableName: this.requireTable(),
        Item: row,
      }),
    );
  }

  async listByIncident(incidentId: string, limit = 500): Promise<TimelineEvent[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTable(),
        KeyConditionExpression: "incidentId = :i",
        ExpressionAttributeValues: { ":i": incidentId },
        ScanIndexForward: true,
        Limit: Math.min(limit, 1000),
      }),
    );
    return (out.Items ?? []).map((row) => {
      const { sk: _sk, ...event } = row as TimelineEventRow;
      return event;
    });
  }
}
