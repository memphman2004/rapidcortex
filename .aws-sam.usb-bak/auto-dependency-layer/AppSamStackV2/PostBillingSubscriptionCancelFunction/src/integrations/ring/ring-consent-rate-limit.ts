import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateTable(): string | null {
  return env.ringRequestsTable?.trim() || null;
}

function windowKey(ip: string): string {
  const windowStart = Math.floor(Date.now() / WINDOW_MS);
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  return `ring-consent-rate#${ipHash}#${windowStart}`;
}

export async function consumeRingConsentRateSlot(ip: string): Promise<boolean> {
  const table = rateTable();
  if (!table || !ip.trim()) return true;

  const ttl = Math.floor(Date.now() / 1000) + Math.ceil(WINDOW_MS / 1000) + 60;
  const agencyIncidentKey = "__ring_consent_rate__";
  const requestId = windowKey(ip);

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: table,
        Key: { agencyIncidentKey, requestId },
        UpdateExpression: "SET #c = if_not_exists(#c, :z) + :one, #ttl = :ttl, itemType = :itemType",
        ExpressionAttributeNames: { "#c": "attemptCount", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":one": 1,
          ":z": 0,
          ":ttl": ttl,
          ":max": MAX_ATTEMPTS,
          ":itemType": "ring_consent_rate",
        },
        ConditionExpression: "(attribute_not_exists(#c) OR #c < :max)",
      }),
    );
    return true;
  } catch (e: unknown) {
    const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
    if (name === "ConditionalCheckFailedException") return false;
    throw e;
  }
}
