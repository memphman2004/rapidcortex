import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

/**
 * One item per RC Lite key per minute window.
 * `bucketKey` = `${keyId}#${YYYYMMDDHHmm}` (UTC).
 * `ttl` unix seconds for TTL cleanup.
 */
export class RcLiteRateLimitRepository {
  private table() {
    const n = env.rcLiteRateLimitTable;
    if (!n) throw new Error("RC_LITE_RATE_LIMIT_TABLE_NOT_CONFIGURED");
    return n;
  }

  async incrementOrThrow(params: { bucketKey: string; limit: number; ttlUnix: number }): Promise<number> {
    try {
      const out = await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { bucketKey: params.bucketKey },
          UpdateExpression: "ADD #c :one SET #ttl = :ttl",
          ConditionExpression: "attribute_not_exists(#c) OR #c < :lim",
          ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
          ExpressionAttributeValues: {
            ":one": 1,
            ":lim": params.limit,
            ":ttl": params.ttlUnix,
          },
          ReturnValues: "UPDATED_NEW",
        }),
      );
      return Number(out.Attributes?.count ?? 0);
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "ConditionalCheckFailedException") {
        const err = new Error("RATE_LIMITED");
        (err as Error & { code?: string }).code = "RATE_LIMITED";
        throw err;
      }
      throw e;
    }
  }
}
