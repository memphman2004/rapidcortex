import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { RapidIqContact } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

function table(): string {
  const t = env.rapidIqContactsTable;
  if (!t) throw new Error("RAPID_IQ_CONTACTS_TABLE_NOT_CONFIGURED");
  return t;
}

export class RapidIqContactRepository {
  async put(contact: RapidIqContact): Promise<void> {
    await ddb.send(new PutCommand({ TableName: table(), Item: contact }));
  }

  async listByOpportunity(opportunityId: string): Promise<RapidIqContact[]> {
    const r = await ddb.send(
      new QueryCommand({
        TableName: table(),
        IndexName: "opportunityId-index",
        KeyConditionExpression: "opportunityId = :o",
        ExpressionAttributeValues: { ":o": opportunityId },
      }),
    );
    return (r.Items as RapidIqContact[]) ?? [];
  }
}
