import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { IncidentChannelAssignment } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class IncidentChannelAssignmentRepository {
  private table(): string {
    const t = env.incidentChannelAssignmentsTable?.trim();
    if (!t) throw new Error("INCIDENT_CHANNEL_ASSIGNMENTS_UNAVAILABLE");
    return t;
  }

  async listByIncident(incidentId: string): Promise<IncidentChannelAssignment[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        KeyConditionExpression: "incidentId = :i",
        ExpressionAttributeValues: { ":i": incidentId },
      }),
    );
    return ((res.Items ?? []) as IncidentChannelAssignment[]).filter((r) => r.active);
  }

  async get(incidentId: string, channelId: string): Promise<IncidentChannelAssignment | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { incidentId, channelId },
      }),
    );
    return (res.Item as IncidentChannelAssignment) ?? null;
  }

  async put(record: IncidentChannelAssignment): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
      }),
    );
  }

  async patchNotes(incidentId: string, channelId: string, notes: string | undefined): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { incidentId, channelId },
        UpdateExpression: "SET notes = :n",
        ExpressionAttributeValues: { ":n": notes ?? null },
        ConditionExpression: "attribute_exists(incidentId)",
      }),
    );
  }

  async remove(incidentId: string, channelId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: this.table(),
        Key: { incidentId, channelId },
      }),
    );
  }
}
