import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AdobeSignAgreementType, PendingProvisionStatus } from "rapid-cortex-shared";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export type PendingProvisionRecord = {
  agreementId: string;
  agencyId: string;
  agreementType: AdobeSignAgreementType;
  customerEmail: string;
  customerName: string;
  contactName?: string;
  tier?: string;
  useCaseDesc?: string;
  status: PendingProvisionStatus;
  keyId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  ttl?: number;
};

export class PendingProvisionRepository {
  private table() {
    const n = env.pendingProvisionsTable;
    if (!n) throw new Error("PENDING_PROVISIONS_TABLE_NOT_CONFIGURED");
    return n;
  }

  async get(agreementId: string): Promise<PendingProvisionRecord | null> {
    const out = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { agreementId },
      }),
    );
    return (out.Item as PendingProvisionRecord | undefined) ?? null;
  }

  async put(record: PendingProvisionRecord): Promise<void> {
    const ttl = Math.floor(Date.now() / 1000) + 90 * 86_400;
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: { ...record, ttl },
      }),
    );
  }

  async updateStatus(
    agreementId: string,
    status: PendingProvisionStatus,
    patch: Partial<Pick<PendingProvisionRecord, "keyId" | "errorMessage">> = {},
  ): Promise<void> {
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { agreementId },
        UpdateExpression:
          "SET #s = :status, updatedAt = :now, keyId = if_not_exists(keyId, :kid), errorMessage = :err",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":status": status,
          ":now": now,
          ":kid": patch.keyId ?? null,
          ":err": patch.errorMessage ?? null,
        },
      }),
    );
  }
}
