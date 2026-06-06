import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { TranscriptSegment } from "rapid-cortex-shared";
import { RETENTION_DUE_GSI, RETENTION_GSI_PK, retentionQueryUpperBoundSk } from "../lib/retentionPolicy.js";

export class TranscriptRepository {
  async add(segment: TranscriptSegment): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.transcriptsTable,
        Item: segment,
      }),
    );
  }

  async listByIncident(incidentId: string): Promise<TranscriptSegment[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.transcriptsTable,
        KeyConditionExpression: "incidentId = :incidentId",
        ExpressionAttributeValues: {
          ":incidentId": incidentId,
        },
        ScanIndexForward: true,
      }),
    );

    return (result.Items as TranscriptSegment[]) ?? [];
  }

  /** Linear scan of incident transcript rows (v1 table has no GSI on segmentId). */
  async findSegmentById(incidentId: string, segmentId: string): Promise<TranscriptSegment | null> {
    const items = await this.listByIncident(incidentId);
    return items.find((s) => s.segmentId === segmentId) ?? null;
  }

  async deleteSegment(incidentId: string, timestamp: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: env.transcriptsTable,
        Key: { incidentId, timestamp },
      }),
    );
  }

  async listRetentionDue(
    pageSize: number,
    startKey?: Record<string, unknown>,
  ): Promise<{ items: TranscriptSegment[]; lastKey?: Record<string, unknown> }> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: env.transcriptsTable,
        IndexName: RETENTION_DUE_GSI,
        KeyConditionExpression: "retGsiPk = :p AND retGsiSk <= :max",
        ExpressionAttributeValues: {
          ":p": RETENTION_GSI_PK,
          ":max": retentionQueryUpperBoundSk(),
        },
        Limit: pageSize,
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );
    return { items: (out.Items as TranscriptSegment[]) ?? [], lastKey: out.LastEvaluatedKey };
  }
}
