import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

/**
 * One item per minute bucket / scope:
 * pk = `${agencyId}#${clientId}#${category}#${minuteEpoch}`
 */
export class ExternalApiRateLimitRepository {
  private table() {
    const n = env.externalApiRateLimitsTable;
    if (!n) throw new Error("EXTERNAL_API_RATE_LIMITS_TABLE_NOT_CONFIGURED");
    return n;
  }

  /**
   * Atomically increment request count for the window; throws if over limit.
   * Returns new count on success.
   */
  async incrementOrThrow(params: {
    pk: string;
    limit: number;
    ttlSeconds: number;
  }): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + params.ttlSeconds;
    try {
      const out = await ddb.send(
        new UpdateCommand({
          TableName: this.table(),
          Key: { pk: params.pk },
          UpdateExpression:
            "ADD #c :one SET expiresAt = if_not_exists(expiresAt, :ex)",
          ConditionExpression: "attribute_not_exists(#c) OR #c < :lim",
          ExpressionAttributeNames: { "#c": "count" },
          ExpressionAttributeValues: {
            ":one": 1,
            ":lim": params.limit,
            ":ex": expiresAt,
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
