import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { cadConnectorTableNames } from "../env.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export type CadConnectorAuditRecord = {
  agencyId: string;
  eventId: string;
  type: string;
  actorId: string;
  connectorId?: string;
  createdAt: string;
  detail: Record<string, unknown>;
};

function auditTable(): string {
  const name = cadConnectorTableNames().audit;
  if (!name) throw new Error("CAD_CONNECTOR_AUDIT_TABLE is not set");
  return name;
}

export class CadConnectorAuditStore {
  async append(record: Omit<CadConnectorAuditRecord, "eventId" | "createdAt"> & { createdAt?: string }): Promise<void> {
    const createdAt = record.createdAt ?? new Date().toISOString();
    const eventId = `${createdAt}#${randomUUID()}`;
    await ddb.send(
      new PutCommand({
        TableName: auditTable(),
        Item: { ...record, eventId, createdAt },
        ConditionExpression: "attribute_not_exists(eventId)",
      }),
    );
  }

  async list(params: {
    agencyId: string;
    connectorId?: string;
    type?: string;
    limit: number;
  }): Promise<CadConnectorAuditRecord[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: auditTable(),
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": params.agencyId.trim() },
        ScanIndexForward: false,
        Limit: Math.min(100, Math.max(1, params.limit)),
      }),
    );
    let items = (result.Items ?? []) as CadConnectorAuditRecord[];
    items = items.filter((row) => row.agencyId === params.agencyId.trim());
    if (params.connectorId) items = items.filter((row) => row.connectorId === params.connectorId);
    if (params.type) items = items.filter((row) => row.type === params.type);
    return items;
  }
}

export const cadConnectorAuditStore = new CadConnectorAuditStore();
