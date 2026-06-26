import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import { ddb } from "../../repositories/baseRepository.js";
import { env } from "../../lib/env.js";

const CONSENT_WINDOW_MS = 15 * 60 * 1000;
const CONSENT_MAX_ATTEMPTS = 10;
const PUBLIC_OAUTH_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_OAUTH_MAX_ATTEMPTS = 10;

export async function consumeRingConsentRateSlot(ip: string): Promise<boolean> {
  return consumeRingRateSlot(ip, {
    sentinelKey: "__ring_consent_rate__",
    itemType: "ring_consent_rate",
    windowMs: CONSENT_WINDOW_MS,
    maxAttempts: CONSENT_MAX_ATTEMPTS,
    keyPrefix: "ring-consent-rate",
  });
}

export async function consumeRingPublicOAuthRateSlot(ip: string): Promise<boolean> {
  return consumeRingRateSlot(ip, {
    sentinelKey: "__ring_public_oauth_rate__",
    itemType: "ring_public_oauth_rate",
    windowMs: PUBLIC_OAUTH_WINDOW_MS,
    maxAttempts: PUBLIC_OAUTH_MAX_ATTEMPTS,
    keyPrefix: "ring-public-oauth-rate",
  });
}

type RateSlotOptions = {
  sentinelKey: string;
  itemType: string;
  windowMs: number;
  maxAttempts: number;
  keyPrefix: string;
};

async function consumeRingRateSlot(ip: string, options: RateSlotOptions): Promise<boolean> {
  const table = rateTable();
  if (!table || !ip.trim()) return true;

  const ttl = Math.floor(Date.now() / 1000) + Math.ceil(options.windowMs / 1000) + 60;
  const agencyIncidentKey = options.sentinelKey;
  const requestId = windowKey(ip, options);

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
          ":max": options.maxAttempts,
          ":itemType": options.itemType,
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

function rateTable(): string | null {
  return env.ringRequestsTable?.trim() || null;
}

function windowKey(ip: string, options: RateSlotOptions): string {
  const windowStart = Math.floor(Date.now() / options.windowMs);
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  return `${options.keyPrefix}#${ipHash}#${windowStart}`;
}
