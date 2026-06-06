import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type DataDeletionResourceType = "incident" | "transcript" | "analysis" | "incident_media";

/** Immutable append-only row — only the retention Lambda should write. */
export type DataDeletionAuditRecord = {
  eventId: string;
  agencyId: string;
  sourceTable: string;
  resourceType: DataDeletionResourceType;
  /** JSON string of primary key for traceability (no raw CJI payload). */
  resourceKeyJson: string;
  policyId: string;
  retentionPolicyId: string;
  reason: "retention_expired";
  /** Denormalized for GSI (immutable audit query by agency and time). */
  deletedAt: string;
  /** System actor for scheduled purges. */
  actorId: string;
};

export class DataDeletionAuditRepository {
  async append(record: DataDeletionAuditRecord): Promise<void> {
    const table = env.dataDeletionAuditTable;
    if (!table) throw new Error("DATA_DELETION_AUDIT_TABLE_UNSET");
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: record,
        ConditionExpression: "attribute_not_exists(eventId)",
      }),
    );
  }
}
