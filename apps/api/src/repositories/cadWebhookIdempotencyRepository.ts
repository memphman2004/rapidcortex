import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../lib/env.js";
import { ddb } from "./baseRepository.js";

export type CadWebhookIdempotencyRecord = {
  dedupeKey: string;
  /** Cached JSON string of `{ incidentId, action }` etc. */
  responseJson: string;
  ttl: number;
};

export class CadWebhookIdempotencyRepository {
  private table(): string | null {
    const t = env.cadWebhookIdempotencyTable?.trim();
    return t || null;
  }

  async get(dedupeKey: string): Promise<CadWebhookIdempotencyRecord | null> {
    const t = this.table();
    if (!t) return null;
    const res = await ddb.send(
      new GetCommand({
        TableName: t,
        Key: { dedupeKey },
      }),
    );
    return (res.Item as CadWebhookIdempotencyRecord | undefined) ?? null;
  }

  async put(record: CadWebhookIdempotencyRecord): Promise<void> {
    const t = this.table();
    if (!t) return;
    await ddb.send(
      new PutCommand({
        TableName: t,
        Item: record,
      }),
    );
  }
}
