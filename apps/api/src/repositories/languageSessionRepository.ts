import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { LanguageCallSession } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export class LanguageSessionRepository {
  private table(): string {
    const t = env.languageSessionsTable;
    if (!t) throw new Error("LANGUAGE_SESSIONS_TABLE_NOT_CONFIGURED");
    return t;
  }

  async put(session: LanguageCallSession): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: session,
      }),
    );
  }

  async get(sessionId: string): Promise<LanguageCallSession | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { sessionId },
      }),
    );
    return (out.Item as LanguageCallSession) ?? null;
  }

  async listByIncident(incidentId: string): Promise<LanguageCallSession[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "incidentId-createdAt-index",
        KeyConditionExpression: "incidentId = :i",
        ExpressionAttributeValues: { ":i": incidentId },
        ScanIndexForward: false,
      }),
    );
    return (out.Items as LanguageCallSession[]) ?? [];
  }

  async patch(sessionId: string, fields: Partial<LanguageCallSession>): Promise<void> {
    const sets: string[] = ["updatedAt = :u"];
    const values: Record<string, unknown> = { ":u": new Date().toISOString() };
    let idx = 0;
    for (const [k, v] of Object.entries(fields)) {
      if (k === "sessionId" || k === "incidentId" || k === "agencyId" || k === "updatedAt") continue;
      if (v === undefined) continue;
      const nk = `:v${idx}`;
      sets.push(`${k} = ${nk}`);
      values[nk] = v;
      idx += 1;
    }
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { sessionId },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ExpressionAttributeValues: values,
      }),
    );
  }

  async tryAdvanceChunkSequence(sessionId: string, sequence: number): Promise<boolean> {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { sessionId },
          UpdateExpression: "SET lastChunkSequence = :s, updatedAt = :u",
          ConditionExpression:
            "attribute_not_exists(lastChunkSequence) OR lastChunkSequence < :s",
          ExpressionAttributeValues: {
            ":s": sequence,
            ":u": new Date().toISOString(),
          },
        }),
      );
      return true;
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "ConditionalCheckFailedException") return false;
      throw e;
    }
  }
}
