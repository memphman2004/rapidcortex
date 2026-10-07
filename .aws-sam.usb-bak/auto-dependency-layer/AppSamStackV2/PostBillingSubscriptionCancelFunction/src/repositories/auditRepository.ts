import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { AuditEvent } from "rapid-cortex-shared";

export class AuditRepository {
  async create(event: AuditEvent): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: env.auditTable,
        Item: event,
      }),
    );
  }

  /** Newest first for an agency (requires `agencyId-createdAt-index` GSI on the audit table). */
  async listByAgency(agencyId: string, limit = 50): Promise<AuditEvent[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: env.auditTable,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as AuditEvent[];
  }

  async listByAgencyBetween(
    agencyId: string,
    fromIso: string,
    toIso: string,
    limit = 2000,
  ): Promise<AuditEvent[]> {
    const out = await ddb.send(
      new QueryCommand({
        TableName: env.auditTable,
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a AND createdAt BETWEEN :f AND :t",
        ExpressionAttributeValues: {
          ":a": agencyId,
          ":f": fromIso,
          ":t": toIso,
        },
        ScanIndexForward: true,
        Limit: limit,
      }),
    );
    return (out.Items ?? []) as AuditEvent[];
  }
}
