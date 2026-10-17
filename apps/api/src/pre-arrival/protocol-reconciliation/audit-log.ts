import { createHash } from "node:crypto";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { ReconciliationAuditRecord } from "rapid-cortex-shared";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

const AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60;

export class ReconciliationAuditLog {
  static computeHash(record: Omit<ReconciliationAuditRecord, "auditHash">): string {
    const sortedKeys = Object.keys(record).sort();
    const canonical = JSON.stringify(record, sortedKeys);
    return createHash("sha256").update(canonical, "utf8").digest("hex");
  }

  static verify(record: ReconciliationAuditRecord): { valid: true } | { valid: false; reason: string } {
    const { auditHash, ...body } = record;
    const recomputed = ReconciliationAuditLog.computeHash(body);
    if (recomputed === auditHash) return { valid: true };
    return {
      valid: false,
      reason: `Hash mismatch — stored: ${auditHash.slice(0, 16)}…, recomputed: ${recomputed.slice(0, 16)}…`,
    };
  }

  async write(record: ReconciliationAuditRecord): Promise<void> {
    const table = env.reconciliationAuditTable;
    if (!table) {
      console.warn(JSON.stringify({ type: "pre_arrival.recon_audit.skip", reason: "table_not_configured" }));
      return;
    }
    const sk = `${record.reconciliationTimestamp}#${record.reconciliationId}`;
    const ttl = Math.floor(Date.now() / 1000) + AUDIT_TTL_SECONDS;
    try {
      await ddb.send(
        new PutCommand({
          TableName: table,
          Item: {
            pk: `INCIDENT#${record.incidentId}`,
            sk,
            agencyId: record.agencyId,
            ...record,
            ttl,
          },
          ConditionExpression: "attribute_not_exists(sk)",
        }),
      );
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) return;
      throw err;
    }
  }

  async listForIncident(incidentId: string, agencyId: string): Promise<ReconciliationAuditRecord[]> {
    const table = env.reconciliationAuditTable;
    if (!table) return [];
    const r = await ddb.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: "pk = :p",
        ExpressionAttributeValues: { ":p": `INCIDENT#${incidentId}` },
        ScanIndexForward: false,
        Limit: 50,
      }),
    );
    return ((r.Items ?? []) as Array<ReconciliationAuditRecord & { agencyId?: string }>)
      .filter((i) => i.agencyId === agencyId)
      .map(({ pk: _p, sk: _s, ttl: _t, ...rest }) => rest as unknown as ReconciliationAuditRecord);
  }
}
