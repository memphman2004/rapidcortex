import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { env } from "../../lib/env.js";
import { ddb } from "../../repositories/baseRepository.js";

const MAX_PER_MINUTE = 1000;

export async function tryConsumeCadWebhookRateSlot(integrationId: string): Promise<"ok" | "limited"> {
  const table = env.cadWebhookRateLimitsTable;
  if (!table) return "ok";
  const minute = Math.floor(Date.now() / 60_000);
  const rateKey = `${integrationId}#${minute}`;
  const ttl = Math.floor(Date.now() / 1000) + 120;
  try {
    const out = await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { rateKey },
        UpdateExpression: "SET #c = if_not_exists(#c, :z) + :one, #ttl = :ttl",
        ExpressionAttributeNames: { "#c": "requestCount", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":one": 1,
          ":z": 0,
          ":ttl": ttl,
          ":max": MAX_PER_MINUTE,
        },
        ConditionExpression: "(attribute_not_exists(#c) OR #c < :max)",
        ReturnValues: "UPDATED_NEW",
      }),
    );
    const c = Number(out.Attributes?.requestCount ?? 0);
    return c > MAX_PER_MINUTE ? "limited" : "ok";
  } catch (e: unknown) {
    const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
    if (name === "ConditionalCheckFailedException") return "limited";
    throw e;
  }
}
