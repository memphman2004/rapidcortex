/**
 * NexCortiQ Loadout — API Gateway Lambda Authorizer (REQUEST type)
 *
 * Responsibilities:
 *  1. Validate API key (sha256 hash lookup in DynamoDB)
 *  2. Verify the requested endpoint is licensed in the key's loadout
 *  3. Verify monthly quota not exhausted for that feature
 *  4. Atomically increment usage counter (ADD — safe under concurrency)
 *  5. Inject context (tenantId, featureId, tier) for downstream Lambdas
 *  6. Return structured DENY with error code for unlicensed/over-quota calls
 *
 * Security notes:
 *  - Plaintext API key is NEVER stored. Only sha256 hash persists.
 *  - Authorizer result cached at API GW for 30s (TTL set in SAM template)
 *    to reduce DynamoDB reads under sustained load.
 *  - Cache is keyed on the API key value, so different keys never collide.
 */

import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
} from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { createHash } from "crypto";
import { ENDPOINT_FEATURE_MAP } from "rapid-cortex-shared";

const db = new DynamoDBClient({ region: process.env.AWS_REGION });
const API_KEYS_TABLE = process.env.API_KEYS_TABLE!;
const USAGE_TABLE = process.env.USAGE_TABLE!;

// ── TYPES ────────────────────────────────────────────────────────────────────

interface KeyRecord {
  tenantId: string;
  tier: string;
  status: "active" | "suspended" | "revoked";
  enabledFeatures: string[];
  quotaPerFeature: Record<string, number>;
  usageThisMonth: Record<string, number>;
  allowedJurisdictions: string[];
}

// ── HANDLER ──────────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayRequestAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> => {
  // Case-insensitive header lookup for x-api-key
  const headersNorm: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers ?? {})) {
    headersNorm[k.toLowerCase()] = v ?? "";
  }
  const rawKey = headersNorm["x-api-key"] ?? "";
  const requestPath = event.path ?? "";
  const httpMethod = event.httpMethod ?? "POST";

  // 1. Key present
  if (!rawKey || rawKey.length < 32) {
    return deny("anonymous", "unauthorized", "Missing or malformed API key.");
  }

  // 2. Hash key — NEVER log the raw value
  const keyHash = sha256(rawKey);

  // 3. Resolve feature from route
  const featureId = ENDPOINT_FEATURE_MAP[requestPath];
  if (!featureId) {
    return deny(
      keyHash,
      "unknown_endpoint",
      `No feature mapped to ${requestPath}.`,
    );
  }

  // 4. Load key record
  let record: KeyRecord | null;
  try {
    record = await getKeyRecord(keyHash);
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "authorizer_db_error",
        keyHash,
        error: String(err),
      }),
    );
    return deny(
      keyHash,
      "service_unavailable",
      "Authorization service temporarily unavailable.",
    );
  }

  // 5. Key active
  if (!record || record.status !== "active") {
    return deny(keyHash, "unauthorized", "Invalid or inactive API key.");
  }

  // 6. Feature licensed
  if (!record.enabledFeatures.includes(featureId)) {
    return denyWithUpgrade(
      keyHash,
      featureId,
      "feature_not_licensed",
      `Your Loadout does not include the ${featureId} feature.`,
    );
  }

  // 7. Quota check
  const quota = record.quotaPerFeature[featureId] ?? 0;
  const used = record.usageThisMonth[featureId] ?? 0;

  if (used >= quota) {
    const resetDate = getResetDate();
    return deny(
      keyHash,
      "quota_exceeded",
      `Monthly quota for ${featureId} exhausted (${used}/${quota}). Resets ${resetDate}.`,
      { resets_on: resetDate, feature: featureId },
    );
  }

  // 8. Increment usage atomically — fire-and-forget, non-blocking
  incrementUsage(record.tenantId, featureId).catch((err: unknown) => {
    console.error(
      JSON.stringify({
        event: "usage_increment_failed",
        tenantId: record.tenantId,
        featureId,
        error: String(err),
      }),
    );
  });

  // 9. Structured log for every authorized call (never logs raw key)
  console.log(
    JSON.stringify({
      event: "loadout_api_call_authorized",
      tenantId: record.tenantId,
      featureId,
      endpoint: requestPath,
      method: httpMethod,
      tier: record.tier,
      quotaUsed: used + 1,
      quotaTotal: quota,
      quotaPct: Math.round(((used + 1) / quota) * 100),
      sha256: keyHash,
    }),
  );

  // 10. Allow — inject context for downstream feature Lambda.
  // Scope to this methodArn so a cached ALLOW cannot authorize other routes.
  return allow(keyHash, event.methodArn, {
    tenantId: record.tenantId,
    featureId,
    tier: record.tier,
    jurisdictions: record.allowedJurisdictions.join(","),
    quotaRemaining: String(quota - used - 1),
  });
};

// ── DB OPERATIONS ────────────────────────────────────────────────────────────

async function getKeyRecord(keyHash: string): Promise<KeyRecord | null> {
  const result = await db.send(
    new GetItemCommand({
      TableName: API_KEYS_TABLE,
      Key: { pk: { S: `APIKEY#${keyHash}` } },
      ProjectionExpression:
        "tenantId,#st,tier,enabledFeatures,quotaPerFeature,usageThisMonth,allowedJurisdictions",
      ExpressionAttributeNames: { "#st": "status" },
    }),
  );

  const item = result.Item;
  if (!item) return null;

  return {
    tenantId: item.tenantId?.S ?? "",
    status: (item.status?.S ?? "revoked") as KeyRecord["status"],
    tier: item.tier?.S ?? "small",
    enabledFeatures: parseStringSetOrList(item.enabledFeatures),
    quotaPerFeature: parseNMap(item.quotaPerFeature?.M),
    usageThisMonth: parseNMap(item.usageThisMonth?.M),
    allowedJurisdictions: parseStringSetOrList(item.allowedJurisdictions),
  };
}

async function incrementUsage(
  tenantId: string,
  featureId: string,
): Promise<void> {
  const month = getCurrentMonth();
  await db.send(
    new UpdateItemCommand({
      TableName: USAGE_TABLE,
      Key: {
        pk: { S: `USAGE#${tenantId}#${month}` },
        sk: { S: `FEATURE#${featureId}` },
      },
      UpdateExpression:
        "ADD callCount :one SET tenantId = if_not_exists(tenantId, :tid), featureId = if_not_exists(featureId, :fid), #month = if_not_exists(#month, :m)",
      ExpressionAttributeNames: { "#month": "month" },
      ExpressionAttributeValues: {
        ":one": { N: "1" },
        ":tid": { S: tenantId },
        ":fid": { S: featureId },
        ":m": { S: month },
      },
    }),
  );
}

// ── POLICY BUILDERS ──────────────────────────────────────────────────────────

function allow(
  principalId: string,
  methodArn: string,
  context: Record<string, string>,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: "Allow",
          Resource: methodArn || "*",
        },
      ],
    },
    context,
  };
}

function deny(
  principalId: string,
  errorCode: string,
  message: string,
  extra?: Record<string, string>,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        { Action: "execute-api:Invoke", Effect: "Deny", Resource: "*" },
      ],
    },
    context: { error_code: errorCode, message, ...extra },
  };
}

function denyWithUpgrade(
  principalId: string,
  featureId: string,
  errorCode: string,
  message: string,
): APIGatewayAuthorizerResult {
  return deny(principalId, errorCode, message, {
    feature: featureId,
    upgrade_url: "https://loadout.nexcortiq.us/catalog",
  });
}

// ── UTILS ────────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function getCurrentMonth(): string {
  return new Date().toISOString().substring(0, 7); // "2026-09"
}

function getResetDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().split("T")[0];
}

function parseStringSetOrList(
  attr?: { SS?: string[]; L?: Array<{ S?: string }> },
): string[] {
  if (!attr) return [];
  if (attr.SS?.length) return attr.SS;
  if (attr.L?.length) {
    return attr.L.map((x) => x.S ?? "").filter(Boolean);
  }
  return [];
}

function parseNMap(
  m?: Record<string, { N?: string }>,
): Record<string, number> {
  if (!m) return {};
  return Object.fromEntries(
    Object.entries(m).map(([k, v]) => [k, Number(v.N ?? 0)]),
  );
}
