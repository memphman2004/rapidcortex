import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { MonetizationInvoiceRecord } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export class MonetizationInvoiceRepository {
  private table(): string {
    const t = env.monetizationInvoicesTable;
    if (!t) throw new Error("MONETIZATION_INVOICES_DISABLED");
    return t;
  }

  async put(row: MonetizationInvoiceRecord): Promise<void> {
    await ddb.send(new PutCommand({ TableName: this.table(), Item: row }));
  }

  async get(invoiceId: string): Promise<MonetizationInvoiceRecord | null> {
    const res = await ddb.send(new GetCommand({ TableName: this.table(), Key: { invoiceId } }));
    return (res.Item as MonetizationInvoiceRecord | undefined) ?? null;
  }

  async listByAgencyRecent(agencyId: string, limit = 48): Promise<MonetizationInvoiceRecord[]> {
    const res = await ddb.send(
      new QueryCommand({
        TableName: this.table(),
        IndexName: "agencyId-createdAt-index",
        KeyConditionExpression: "agencyId = :a",
        ExpressionAttributeValues: { ":a": agencyId },
        ScanIndexForward: false,
        Limit: limit,
      }),
    );
    return (res.Items as MonetizationInvoiceRecord[]) ?? [];
  }
}
