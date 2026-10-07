import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { QAProtocolTemplate, QASession } from "rapid-cortex-shared";

export class QARepository {
  private requireSessionsTable(): string {
    const t = env.qaSessionsTable;
    if (!t) throw new Error("QA_SESSIONS_TABLE_NOT_CONFIGURED");
    return t;
  }

  private requireTemplatesTable(): string {
    const t = env.qaTemplatesTable;
    if (!t) throw new Error("QA_TEMPLATES_TABLE_NOT_CONFIGURED");
    return t;
  }

  async putSession(row: QASession): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireSessionsTable(),
        Item: row,
      }),
    );
  }

  async getSession(agencyId: string, sessionId: string): Promise<QASession | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireSessionsTable(),
        Key: { agencyId, sessionId },
      }),
    );
    return (out.Item as QASession) ?? null;
  }

  async listSessionsForAgency(agencyId: string, limit = 100): Promise<QASession[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireSessionsTable(),
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items as QASession[]) ?? [];
  }

  /** Query by agency partition; filter by incident (FilterExpression still scopes reads to the agency PK). */
  async listSessionsForIncident(agencyId: string, incidentId: string, limit = 100): Promise<QASession[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireSessionsTable(),
        KeyConditionExpression: "agencyId = :a",
        FilterExpression: "incidentId = :i",
        ExpressionAttributeValues: { ":a": agencyId, ":i": incidentId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items as QASession[]) ?? [];
  }

  async putTemplate(row: QAProtocolTemplate): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.requireTemplatesTable(),
        Item: row,
      }),
    );
  }

  async getTemplate(agencyId: string, templateId: string): Promise<QAProtocolTemplate | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.requireTemplatesTable(),
        Key: { agencyId, templateId },
      }),
    );
    return (out.Item as QAProtocolTemplate) ?? null;
  }

  async listTemplatesForAgency(agencyId: string, limit = 200): Promise<QAProtocolTemplate[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.requireTemplatesTable(),
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        Limit: limit,
      }),
    );
    return (out.Items as QAProtocolTemplate[]) ?? [];
  }

  async deleteTemplate(agencyId: string, templateId: string): Promise<void> {
    await ddb.send(
      new DeleteCommand({
        TableName: this.requireTemplatesTable(),
        Key: { agencyId, templateId },
      }),
    );
  }
}
