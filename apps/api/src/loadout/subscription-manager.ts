/**
 * NexCortiQ Loadout — Subscription Manager
 *
 * HttpApi (APIGatewayProxyEventV2) handler for all self-serve Loadout mutations.
 *
 * Routes:
 *   GET  /api/loadout/features           — list active features with usage
 *   POST /api/loadout/features/add       — activate a self-serve feature immediately
 *   POST /api/loadout/features/remove    — deactivate a feature
 *   POST /api/loadout/enterprise/request — submit enterprise provisioning request
 *   GET  /api/loadout/invoice/preview    — project current period invoice
 *
 * Also accepts paths without the /api prefix for flexibility.
 *
 * Auth: Cognito JWT via getUserContext. tenantId = user.agencyId.
 * Role gate: agencyadmin, rcsuperadmin, rcadmin (and recognized aliases).
 *
 * Design decisions:
 *   - Features activate IMMEDIATELY to reduce friction
 *   - Pro-rata billing calculated by invoice generator at period close
 *   - Every mutation written to SWAP_HISTORY for audit trail
 *   - Enterprise requests fire SNS notification to RC ops team
 *   - Subscription writes use optimistic concurrency on version field
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "crypto";
import {
  LOADOUT_FEATURES,
  featureLineCost,
  formatCentsAsUsd,
} from "rapid-cortex-shared";
import {
  ACCOUNT_INACTIVE_MESSAGE,
  getUserContext,
  isUserAccountActive,
} from "../lib/auth.js";
import { forbidden, unauthorized } from "../lib/response.js";

// ── ENV ───────────────────────────────────────────────────────────────────────

const db = new DynamoDBClient({});
const sns = new SNSClient({});

const SUBS_TABLE = process.env.SUBSCRIPTIONS_TABLE!;
const APIKEYS_TABLE = process.env.API_KEYS_TABLE!;
const USAGE_TABLE = process.env.USAGE_TABLE!;
const HISTORY_TABLE = process.env.SWAP_HISTORY_TABLE!;
const OPS_SNS_TOPIC = process.env.OPS_SNS_TOPIC_ARN!;

// ── ROLE GATE ─────────────────────────────────────────────────────────────────

const ALLOWED_ROLES = new Set([
  "agencyadmin",
  "rcsuperadmin",
  "rcadmin",
  "rcitadmin",
  // rcadmin aliases
  "rc_admin",
  "rc_superadmin",
]);

// ── HANDLER ───────────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  // 1. Auth
  const user = await getUserContext(event);
  if (!user) return unauthorized();
  if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
  if (!ALLOWED_ROLES.has(user.role)) {
    return forbidden("Loadout management requires agencyadmin or RC admin role.");
  }

  const tenantId = user.agencyId;
  const method = event.requestContext.http.method.toUpperCase();
  const rawPath = event.rawPath ?? "";

  // Normalise: strip /api prefix so we match with or without it
  const path = rawPath.replace(/^\/api/, "");

  const body = parseBody(event.body ?? null);

  try {
    if (method === "GET" && path === "/loadout/features")
      return await listFeatures(tenantId);
    if (method === "POST" && path === "/loadout/features/add")
      return await addFeature(tenantId, body?.featureId as string | undefined);
    if (method === "POST" && path === "/loadout/features/remove")
      return await removeFeature(
        tenantId,
        body?.featureId as string | undefined,
      );
    if (method === "POST" && path === "/loadout/enterprise/request")
      return await enterpriseRequest(
        tenantId,
        body as Record<string, string>,
      );
    if (method === "GET" && path === "/loadout/invoice/preview")
      return await invoicePreview(tenantId);

    return apiErr(404, "not_found", "Unknown route");
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "subscription_manager_error",
        tenantId,
        error: String(err),
      }),
    );
    return apiErr(500, "internal_error", "An unexpected error occurred");
  }
};

// ── ADD FEATURE ───────────────────────────────────────────────────────────────

async function addFeature(
  tenantId: string,
  featureId: string | undefined,
): Promise<APIGatewayProxyResultV2> {
  if (!featureId)
    return apiErr(400, "missing_field", "featureId is required");

  const feature = LOADOUT_FEATURES[featureId];
  if (!feature)
    return apiErr(404, "feature_not_found", `Unknown feature: ${featureId}`);
  if (feature.enterprise)
    return apiErr(
      400,
      "enterprise_required",
      "This feature requires a provisioning call. Submit via /loadout/enterprise/request.",
      "https://loadout.nexcortiq.us/catalog",
    );

  const sub = await getSubscription(tenantId);
  if (!sub) return apiErr(404, "subscription_not_found", "Subscription not found");

  if (sub.activeFeatures.includes(featureId)) {
    return apiOk(200, { message: "Feature already active", featureId });
  }

  const updatedFeatures = [...sub.activeFeatures, featureId];

  await updateActiveFeatures(tenantId, updatedFeatures, sub.version);

  // Update API key permissions — best-effort async
  updateKeyPermissions(tenantId, updatedFeatures).catch((err: unknown) => {
    console.error(
      JSON.stringify({
        event: "key_permission_update_failed",
        tenantId,
        error: String(err),
      }),
    );
  });

  await writeSwapHistory(tenantId, {
    action: "add",
    featureId,
    source: "self-serve",
  });

  console.log(JSON.stringify({ event: "feature_added", tenantId, featureId }));

  return apiOk(201, {
    message: `${feature.name} is now active in your Loadout.`,
    featureId,
    monthlyBaseCents: feature.monthlyBaseCents,
    endpoint: feature.endpoint,
    activatedAt: new Date().toISOString(),
  });
}

// ── REMOVE FEATURE ────────────────────────────────────────────────────────────

async function removeFeature(
  tenantId: string,
  featureId: string | undefined,
): Promise<APIGatewayProxyResultV2> {
  if (!featureId)
    return apiErr(400, "missing_field", "featureId is required");

  const sub = await getSubscription(tenantId);
  if (!sub) return apiErr(404, "subscription_not_found", "Subscription not found");

  if (!sub.activeFeatures.includes(featureId)) {
    return apiErr(400, "feature_not_active", "Feature is not in your Loadout");
  }

  const updatedFeatures = sub.activeFeatures.filter((id) => id !== featureId);

  await updateActiveFeatures(tenantId, updatedFeatures, sub.version);
  await updateKeyPermissions(tenantId, updatedFeatures);
  await writeSwapHistory(tenantId, {
    action: "remove",
    featureId,
    source: "self-serve",
  });

  console.log(
    JSON.stringify({ event: "feature_removed", tenantId, featureId }),
  );

  return apiOk(200, {
    message: `${LOADOUT_FEATURES[featureId]?.name} has been removed from your Loadout.`,
    featureId,
    removedAt: new Date().toISOString(),
  });
}

// ── LIST FEATURES ─────────────────────────────────────────────────────────────

async function listFeatures(
  tenantId: string,
): Promise<APIGatewayProxyResultV2> {
  const sub = await getSubscription(tenantId);
  if (!sub) return apiErr(404, "subscription_not_found", "Subscription not found");

  const month = currentMonth();
  const usageMap = await getUsage(tenantId, month);

  const features = sub.activeFeatures
    .map((featureId) => {
      const f = LOADOUT_FEATURES[featureId];
      if (!f) return null;
      const used = usageMap[featureId] ?? 0;
      const { baseCents, overageCents, totalCents } = featureLineCost(
        featureId,
        used,
      );
      return {
        featureId,
        name: f.name,
        category: f.category,
        endpoint: f.endpoint,
        monthlyBaseCents: f.monthlyBaseCents,
        includedCalls: f.includedCalls,
        overagePer1kCents: f.overagePer1kCents,
        callsUsed: used,
        callsRemaining: f.includedCalls
          ? Math.max(0, f.includedCalls - used)
          : null,
        usagePct: f.includedCalls
          ? Math.round((used / f.includedCalls) * 100)
          : null,
        currentCostCents: totalCents,
        overageAmountCents: overageCents,
        baseAmountCents: baseCents,
      };
    })
    .filter(Boolean);

  const totals = features.reduce(
    (acc, f) => {
      if (!f) return acc;
      acc.baseCents += f.baseAmountCents;
      acc.overageCents += f.overageAmountCents;
      acc.totalCents += f.currentCostCents;
      return acc;
    },
    { baseCents: 0, overageCents: 0, totalCents: 0 },
  );

  return apiOk(200, {
    tenantId,
    period: month,
    features,
    summary: totals,
  });
}

// ── ENTERPRISE REQUEST ────────────────────────────────────────────────────────

async function enterpriseRequest(
  tenantId: string,
  body: Record<string, string>,
): Promise<APIGatewayProxyResultV2> {
  const { featureId, contactName, contactEmail, bestTime, notes } = body ?? {};

  if (!featureId || !contactEmail) {
    return apiErr(
      400,
      "missing_fields",
      "featureId and contactEmail are required",
    );
  }

  const feature = LOADOUT_FEATURES[featureId];
  if (!feature?.enterprise) {
    return apiErr(
      400,
      "not_enterprise",
      "Feature does not require provisioning",
    );
  }

  const requestId = `PROV-${Date.now()}-${tenantId.substring(0, 6).toUpperCase()}`;

  await sns.send(
    new PublishCommand({
      TopicArn: OPS_SNS_TOPIC,
      Subject: `Enterprise provisioning request: ${feature.name} — ${tenantId}`,
      Message: JSON.stringify({
        requestId,
        tenantId,
        featureId,
        featureName: feature.name,
        contactName,
        contactEmail,
        bestTime,
        notes,
        requestedAt: new Date().toISOString(),
      }),
      MessageAttributes: {
        event_type: {
          DataType: "String",
          StringValue: "enterprise_provision_request",
        },
      },
    }),
  );

  await writeSwapHistory(tenantId, {
    action: "enterprise_request",
    featureId,
    source: "portal",
    requestId,
  });

  console.log(
    JSON.stringify({
      event: "enterprise_request_submitted",
      tenantId,
      featureId,
      requestId,
    }),
  );

  return apiOk(202, {
    message:
      "Provisioning request received. Expect an email within 1 business day.",
    requestId,
    featureId,
    featureName: feature.name,
  });
}

// ── INVOICE PREVIEW ───────────────────────────────────────────────────────────

async function invoicePreview(
  tenantId: string,
): Promise<APIGatewayProxyResultV2> {
  const sub = await getSubscription(tenantId);
  if (!sub) return apiErr(404, "subscription_not_found", "Subscription not found");

  const month = currentMonth();
  const usageMap = await getUsage(tenantId, month);

  const lineItems = sub.activeFeatures
    .map((featureId) => {
      const f = LOADOUT_FEATURES[featureId];
      if (!f || !f.monthlyBaseCents) return null;
      const used = usageMap[featureId] ?? 0;
      const { baseCents, overageCents, totalCents } = featureLineCost(
        featureId,
        used,
      );
      return {
        featureId,
        featureName: f.name,
        callsUsed: used,
        baseCents,
        overageCents,
        totalCents,
        // Human-readable display helpers (dollars)
        baseDisplay: formatCentsAsUsd(baseCents),
        overageDisplay: formatCentsAsUsd(overageCents),
        totalDisplay: formatCentsAsUsd(totalCents),
      };
    })
    .filter(Boolean);

  const totalDueCents = lineItems.reduce((s, l) => s + (l?.totalCents ?? 0), 0);

  return apiOk(200, {
    tenantId,
    period: month,
    status: "preview",
    lineItems,
    totalDueCents,
    totalDueDisplay: formatCentsAsUsd(totalDueCents),
    generatedAt: new Date().toISOString(),
  });
}

// ── DB HELPERS ────────────────────────────────────────────────────────────────

async function getSubscription(tenantId: string) {
  const result = await db.send(
    new GetItemCommand({
      TableName: SUBS_TABLE,
      Key: { pk: { S: `SUB#${tenantId}` }, sk: { S: "SUBSCRIPTION" } },
    }),
  );
  const item = result.Item;
  if (!item) return null;
  return {
    tenantId,
    activeFeatures: item.activeFeatures?.SS ?? [],
    version: item.version?.N ?? "0",
  };
}

async function updateActiveFeatures(
  tenantId: string,
  features: string[],
  expectedVersion: string,
): Promise<void> {
  const newVersion = String(Number(expectedVersion) + 1);
  // Use SS type for non-empty, NULL for empty (DynamoDB does not allow empty SS)
  const featureAttr = features.length
    ? { SS: features }
    : { NULL: true as const };
  await db.send(
    new UpdateItemCommand({
      TableName: SUBS_TABLE,
      Key: { pk: { S: `SUB#${tenantId}` }, sk: { S: "SUBSCRIPTION" } },
      UpdateExpression:
        "SET activeFeatures = :f, #ver = :nv, updatedAt = :ts",
      ConditionExpression: "#ver = :ev",
      ExpressionAttributeNames: { "#ver": "version" },
      ExpressionAttributeValues: {
        ":f": featureAttr,
        ":nv": { N: newVersion },
        ":ev": { N: expectedVersion },
        ":ts": { S: new Date().toISOString() },
      },
    }),
  );
}

async function updateKeyPermissions(
  tenantId: string,
  features: string[],
): Promise<void> {
  const featureAttr = features.length
    ? { SS: features }
    : { NULL: true as const };
  await db.send(
    new UpdateItemCommand({
      TableName: APIKEYS_TABLE,
      Key: { pk: { S: `TENANT#${tenantId}` } },
      UpdateExpression:
        "SET enabledFeatures = :f, permissionsUpdatedAt = :ts",
      ExpressionAttributeValues: {
        ":f": featureAttr,
        ":ts": { S: new Date().toISOString() },
      },
    }),
  );
}

async function writeSwapHistory(
  tenantId: string,
  data: Record<string, string>,
): Promise<void> {
  const ts = new Date().toISOString();
  await db.send(
    new PutItemCommand({
      TableName: HISTORY_TABLE,
      Item: {
        pk: { S: `SWAP#${tenantId}` },
        sk: { S: `${ts}#${randomUUID()}` },
        tenantId: { S: tenantId },
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, { S: v }]),
        ),
        createdAt: { S: ts },
      },
    }),
  );
}

async function getUsage(
  tenantId: string,
  month: string,
): Promise<Record<string, number>> {
  const result = await db.send(
    new QueryCommand({
      TableName: USAGE_TABLE,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": { S: `USAGE#${tenantId}#${month}` },
      },
    }),
  );
  const map: Record<string, number> = {};
  for (const item of result.Items ?? []) {
    const fid = item.sk?.S?.replace("FEATURE#", "");
    if (fid) map[fid] = Number(item.callCount?.N ?? 0);
  }
  return map;
}

function currentMonth(): string {
  return new Date().toISOString().substring(0, 7);
}

// ── RESPONSE HELPERS ──────────────────────────────────────────────────────────

function apiOk(
  status: number,
  body: Record<string, unknown>,
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "X-Request-Id": randomUUID(),
    },
    body: JSON.stringify({ success: true, ...body }),
  };
}

function apiErr(
  status: number,
  error: string,
  message: string,
  upgradeUrl?: string,
): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: false,
      error,
      message,
      ...(upgradeUrl ? { upgrade_url: upgradeUrl } : {}),
    }),
  };
}

function parseBody(raw: string | null): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
