import { DeleteCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { AIAnalysis } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import { RETENTION_DUE_GSI, RETENTION_GSI_PK, retentionQueryUpperBoundSk } from "../lib/retentionPolicy.js";

export class AnalysisRepository {
  async create(analysis: AIAnalysis): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.analysesTable,
        Item: analysis,
      }),
    );
  }

  async listByIncident(incidentId: string): Promise<AIAnalysis[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.analysesTable,
        KeyConditionExpression: "incidentId = :incidentId",
        ExpressionAttributeValues: {
          ":incidentId": incidentId,
        },
        ScanIndexForward: false,
      }),
    );

    return (result.Items as AIAnalysis[]) ?? [];
  }

  async deleteOne(incidentId: string, createdAt: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: env.analysesTable,
        Key: { incidentId, createdAt },
      }),
    );
  }

  async listRetentionDue(
    pageSize: number,
    startKey?: Record<string, unknown>,
  ): Promise<{ items: AIAnalysis[]; lastKey?: Record<string, unknown> }> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: env.analysesTable,
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
    return { items: (out.Items as AIAnalysis[]) ?? [], lastKey: out.LastEvaluatedKey };
  }
}
