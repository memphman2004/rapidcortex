/**
 * NexCortiQ Loadout — Subscription Manager
 *
 * Handles all loadout mutations:
 *   POST /loadout/features/add      — activate a self-serve feature immediately
 *   POST /loadout/features/remove   — deactivate a feature
 *   GET  /loadout/features          — list active features with usage
 *   POST /loadout/enterprise/request — submit enterprise provisioning request
 *   GET  /loadout/invoice/preview   — project current period invoice
 *
 * Design decisions:
 *   - Features activate IMMEDIATELY (no end-of-cycle queue) to reduce friction
 *   - Pro-rata billing calculated by invoice generator at period close
 *   - Every mutation is written to SWAP_HISTORY for audit trail
 *   - Enterprise requests fire a notification to the RC ops team via SNS
 *   - All writes use conditional expressions for optimistic concurrency
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  PutItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { LOADOUT_FEATURES, featureLineCost } from './loadout-features';
import { randomUUID } from 'crypto';

const db  = new DynamoDBClient({});
const sns = new SNSClient({});

const SUBS_TABLE      = process.env.SUBSCRIPTIONS_TABLE!;
const APIKEYS_TABLE   = process.env.API_KEYS_TABLE!;
const USAGE_TABLE     = process.env.USAGE_TABLE!;
const HISTORY_TABLE   = process.env.SWAP_HISTORY_TABLE!;
const OPS_SNS_TOPIC   = process.env.OPS_SNS_TOPIC!;

// ── ROUTER ───────────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const tenantId = event.requestContext.authorizer?.tenantId as string;
  if (!tenantId) return apiErr(401, 'unauthorized', 'No tenant context');

  const method = event.httpMethod;
  const path   = event.resource;
  const body   = parseBody(event.body);

  try {
    if (method === 'GET'  && path === '/loadout/features')           return await listFeatures(tenantId);
    if (method === 'POST' && path === '/loadout/features/add')       return await addFeature(tenantId, body?.featureId);
    if (method === 'POST' && path === '/loadout/features/remove')    return await removeFeature(tenantId, body?.featureId);
    if (method === 'POST' && path === '/loadout/enterprise/request') return await enterpriseRequest(tenantId, body);
    if (method === 'GET'  && path === '/loadout/invoice/preview')    return await invoicePreview(tenantId);
    return apiErr(404, 'not_found', 'Unknown route');
  } catch (err) {
    console.error(JSON.stringify({ event: 'subscription_manager_error', tenantId, error: String(err) }));
    return apiErr(500, 'internal_error', 'An unexpected error occurred');
  }
};

// ── ADD FEATURE ──────────────────────────────────────────────────────────────

async function addFeature(
  tenantId: string,
  featureId: string
): Promise<APIGatewayProxyResult> {
  if (!featureId) return apiErr(400, 'missing_field', 'featureId is required');

  const feature = LOADOUT_FEATURES[featureId];
  if (!feature) return apiErr(404, 'feature_not_found', `Unknown feature: ${featureId}`);
  if (feature.enterprise) return apiErr(400, 'enterprise_required', 'This feature requires a provisioning call. Submit via /loadout/enterprise/request.');

  const sub = await getSubscription(tenantId);
  if (!sub) return apiErr(404, 'subscription_not_found', 'Subscription not found');

  if (sub.activeFeatures.includes(featureId)) {
    return apiOk(200, { message: 'Feature already active', featureId });
  }

  const updatedFeatures = [...sub.activeFeatures, featureId];

  // 1. Update subscription
  await updateActiveFeatures(tenantId, updatedFeatures, sub.version);

  // 2. Update API key permissions (async, best-effort — authorizer re-checks DB)
  updateKeyPermissions(tenantId, updatedFeatures).catch(err => {
    console.error(JSON.stringify({ event: 'key_permission_update_failed', tenantId, error: String(err) }));
  });

  // 3. Write audit record
  await writeSwapHistory(tenantId, { action: 'add', featureId, source: 'self-serve' });

  console.log(JSON.stringify({ event: 'feature_added', tenantId, featureId }));

  return apiOk(201, {
    message: `${feature.name} is now active in your Loadout.`,
    featureId,
    monthlyBase: feature.monthlyBase,
    endpoint: feature.endpoint,
    activatedAt: new Date().toISOString(),
  });
}

// ── REMOVE FEATURE ───────────────────────────────────────────────────────────

async function removeFeature(
  tenantId: string,
  featureId: string
): Promise<APIGatewayProxyResult> {
  if (!featureId) return apiErr(400, 'missing_field', 'featureId is required');

  const sub = await getSubscription(tenantId);
  if (!sub) return apiErr(404, 'subscription_not_found', 'Subscription not found');

  if (!sub.activeFeatures.includes(featureId)) {
    return apiErr(400, 'feature_not_active', 'Feature is not in your Loadout');
  }

  const updatedFeatures = sub.activeFeatures.filter(id => id !== featureId);

  await updateActiveFeatures(tenantId, updatedFeatures, sub.version);
  await updateKeyPermissions(tenantId, updatedFeatures);
  await writeSwapHistory(tenantId, { action: 'remove', featureId, source: 'self-serve' });

  console.log(JSON.stringify({ event: 'feature_removed', tenantId, featureId }));

  return apiOk(200, {
    message: `${LOADOUT_FEATURES[featureId]?.name} has been removed from your Loadout.`,
    featureId,
    removedAt: new Date().toISOString(),
  });
}

// ── LIST FEATURES ────────────────────────────────────────────────────────────

async function listFeatures(tenantId: string): Promise<APIGatewayProxyResult> {
  const sub   = await getSubscription(tenantId);
  if (!sub) return apiErr(404, 'subscription_not_found', 'Subscription not found');

  const month    = currentMonth();
  const usageMap = await getUsage(tenantId, month);

  const features = sub.activeFeatures.map(featureId => {
    const f    = LOADOUT_FEATURES[featureId];
    if (!f) return null;
    const used = usageMap[featureId] ?? 0;
    const { base, overage, total } = featureLineCost(featureId, used);
    return {
      featureId,
      name:           f.name,
      category:       f.category,
      endpoint:       f.endpoint,
      monthlyBase:    f.monthlyBase,
      includedCalls:  f.includedCalls,
      overagePer1k:   f.overagePer1k,
      callsUsed:      used,
      callsRemaining: f.includedCalls ? Math.max(0, f.includedCalls - used) : null,
      usagePct:       f.includedCalls ? Math.round((used / f.includedCalls) * 100) : null,
      currentCost:    total,
      overageAmount:  overage,
    };
  }).filter(Boolean);

  const totals = features.reduce((acc, f) => {
    acc.base     += f!.monthlyBase ?? 0;
    acc.overage  += f!.overageAmount;
    acc.total    += f!.currentCost;
    return acc;
  }, { base: 0, overage: 0, total: 0 });

  return apiOk(200, {
    tenantId,
    period:   month,
    features,
    summary:  totals,
  });
}

// ── ENTERPRISE REQUEST ───────────────────────────────────────────────────────

async function enterpriseRequest(
  tenantId: string,
  body: Record<string, string>
): Promise<APIGatewayProxyResult> {
  const { featureId, contactName, contactEmail, bestTime, notes } = body ?? {};

  if (!featureId || !contactEmail) {
    return apiErr(400, 'missing_fields', 'featureId and contactEmail are required');
  }

  const feature = LOADOUT_FEATURES[featureId];
  if (!feature?.enterprise) {
    return apiErr(400, 'not_enterprise', 'Feature does not require provisioning');
  }

  const requestId = `PROV-${Date.now()}-${tenantId.substring(0,6).toUpperCase()}`;

  // Notify ops team via SNS
  await sns.send(new PublishCommand({
    TopicArn: OPS_SNS_TOPIC,
    Subject:  `Enterprise provisioning request: ${feature.name} — ${tenantId}`,
    Message:  JSON.stringify({
      requestId,
      tenantId,
      featureId,
      featureName:   feature.name,
      contactName,
      contactEmail,
      bestTime,
      notes,
      requestedAt:   new Date().toISOString(),
    }),
    MessageAttributes: {
      event_type: { DataType: 'String', StringValue: 'enterprise_provision_request' },
    },
  }));

  // Log to swap history for audit
  await writeSwapHistory(tenantId, {
    action: 'enterprise_request',
    featureId,
    source: 'portal',
    requestId,
  });

  console.log(JSON.stringify({ event: 'enterprise_request_submitted', tenantId, featureId, requestId }));

  return apiOk(202, {
    message: 'Provisioning request received. Expect an email within 1 business day.',
    requestId,
    featureId,
    featureName: feature.name,
  });
}

// ── INVOICE PREVIEW ──────────────────────────────────────────────────────────

async function invoicePreview(tenantId: string): Promise<APIGatewayProxyResult> {
  const sub   = await getSubscription(tenantId);
  if (!sub) return apiErr(404, 'subscription_not_found', 'Subscription not found');

  const month    = currentMonth();
  const usageMap = await getUsage(tenantId, month);

  const lineItems = sub.activeFeatures.map(featureId => {
    const f    = LOADOUT_FEATURES[featureId];
    if (!f || !f.monthlyBase) return null;
    const used = usageMap[featureId] ?? 0;
    const { base, overage, total } = featureLineCost(featureId, used);
    return { featureId, featureName: f.name, callsUsed: used, base, overage, total };
  }).filter(Boolean);

  const totalDue = lineItems.reduce((s, l) => s + l!.total, 0);

  return apiOk(200, {
    tenantId,
    period: month,
    status: 'preview',
    lineItems,
    totalDue,
    generatedAt: new Date().toISOString(),
  });
}

// ── DB HELPERS ───────────────────────────────────────────────────────────────

async function getSubscription(tenantId: string) {
  const result = await db.send(new GetItemCommand({
    TableName: SUBS_TABLE,
    Key: { pk: { S: `SUB#${tenantId}` }, sk: { S: 'SUBSCRIPTION' } },
  }));
  const item = result.Item;
  if (!item) return null;
  return {
    tenantId,
    activeFeatures: item.activeFeatures?.SS ?? [],
    version:        item.version?.N ?? '0',
  };
}

async function updateActiveFeatures(
  tenantId: string,
  features: string[],
  expectedVersion: string
): Promise<void> {
  const newVersion = String(Number(expectedVersion) + 1);
  await db.send(new UpdateItemCommand({
    TableName: SUBS_TABLE,
    Key: { pk: { S: `SUB#${tenantId}` }, sk: { S: 'SUBSCRIPTION' } },
    UpdateExpression: 'SET activeFeatures = :f, #ver = :nv, updatedAt = :ts',
    ConditionExpression: '#ver = :ev',
    ExpressionAttributeNames: { '#ver': 'version' },
    ExpressionAttributeValues: {
      ':f':  features.length ? { SS: features } : { NULL: true },
      ':nv': { N: newVersion },
      ':ev': { N: expectedVersion },
      ':ts': { S: new Date().toISOString() },
    },
  }));
}

async function updateKeyPermissions(
  tenantId: string,
  features: string[]
): Promise<void> {
  await db.send(new UpdateItemCommand({
    TableName: APIKEYS_TABLE,
    Key: { pk: { S: `TENANT#${tenantId}` } },
    UpdateExpression: 'SET enabledFeatures = :f, permissionsUpdatedAt = :ts',
    ExpressionAttributeValues: {
      ':f':  features.length ? { SS: features } : { NULL: true },
      ':ts': { S: new Date().toISOString() },
    },
  }));
}

async function writeSwapHistory(
  tenantId: string,
  data: Record<string, string>
): Promise<void> {
  const ts = new Date().toISOString();
  await db.send(new PutItemCommand({
    TableName: HISTORY_TABLE,
    Item: {
      pk:          { S: `SWAP#${tenantId}` },
      sk:          { S: `${ts}#${randomUUID()}` },
      tenantId:    { S: tenantId },
      ...Object.fromEntries(Object.entries(data).map(([k,v]) => [k, { S: v }])),
      createdAt:   { S: ts },
    },
  }));
}

async function getUsage(
  tenantId: string,
  month: string
): Promise<Record<string, number>> {
  const result = await db.send(new QueryCommand({
    TableName: USAGE_TABLE,
    KeyConditionExpression: 'pk = :pk',
    ExpressionAttributeValues: { ':pk': { S: `USAGE#${tenantId}#${month}` } },
  }));
  const map: Record<string, number> = {};
  for (const item of result.Items ?? []) {
    const fid = item.sk?.S?.replace('FEATURE#', '');
    if (fid) map[fid] = Number(item.callCount?.N ?? 0);
  }
  return map;
}

function currentMonth(): string {
  return new Date().toISOString().substring(0, 7);
}

// ── RESPONSE HELPERS ──────────────────────────────────────────────────────────

function apiOk(status: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': randomUUID() },
    body: JSON.stringify({ success: true, ...body }),
  };
}

function apiErr(
  status: number,
  error: string,
  message: string
): APIGatewayProxyResult {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: false,
      error,
      message,
      upgrade_url: error === 'enterprise_required' ? 'https://loadout.nexcortiq.us/catalog' : undefined,
    }),
  };
}

function parseBody(raw: string | null): Record<string, string> {
  try { return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
