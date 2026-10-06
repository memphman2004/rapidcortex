/**
 * NexiQ Intel — API Handler
 * Target: apps/api/src/nexiq-intel/intel-api/index.ts
 *
 * Routes (all under HttpApi, gated by verifyJwt + requireRole):
 *
 *   Source Registry (rcadmin / rcsuperadmin only):
 *     GET    /api/rc-admin/nexiq/intel/sources            — list sources
 *     POST   /api/rc-admin/nexiq/intel/sources            — create source
 *     GET    /api/rc-admin/nexiq/intel/sources/:sourceId  — get source
 *     PATCH  /api/rc-admin/nexiq/intel/sources/:sourceId  — update source
 *     DELETE /api/rc-admin/nexiq/intel/sources/:sourceId  — disable source
 *     POST   /api/rc-admin/nexiq/intel/sources/:sourceId/run — trigger run now
 *
 *   Source Runs:
 *     GET    /api/rc-admin/nexiq/intel/sources/:sourceId/runs — list runs
 *     GET    /api/rc-admin/nexiq/intel/runs/:runId            — get run
 *
 *   Documents:
 *     GET    /api/rc-admin/nexiq/intel/sources/:sourceId/documents
 *     GET    /api/rc-admin/nexiq/intel/documents/:docId
 *     POST   /api/rc-admin/nexiq/intel/documents/:docId/reprocess
 *
 *   Signals:
 *     GET    /api/rc-admin/nexiq/intel/signals
 *
 *   Coverage Dashboard:
 *     GET    /api/rc-admin/nexiq/intel/coverage            — today's snapshot
 *     GET    /api/rc-admin/nexiq/intel/coverage/history    — last N days
 *
 *   Discovery Gaps:
 *     GET    /api/rc-admin/nexiq/intel/gaps
 *     POST   /api/rc-admin/nexiq/intel/gaps               — record a gap
 *     GET    /api/rc-admin/nexiq/intel/gaps/:gapId
 *
 *   Benchmarks:
 *     GET    /api/rc-admin/nexiq/intel/benchmarks
 *     POST   /api/rc-admin/nexiq/intel/benchmarks
 *     POST   /api/rc-admin/nexiq/intel/benchmarks/run     — run benchmark test
 *     GET    /api/rc-admin/nexiq/intel/benchmarks/:benchmarkId
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Handler } from "aws-lambda";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { randomUUID } from "node:crypto";
import { canAccessSalesLeadsCrm } from "rapid-cortex-shared";
import type {
  IntelligenceSource,
  IntelSourceRun,
  IntelDocument,
  IntelSignal,
  DiscoveryGap,
  DiscoveryBenchmark,
  IntelCoverageSnapshot,
  CreateIntelligenceSourceRequest,
  UpdateIntelligenceSourceRequest,
  IntelSchedulerEvent,
} from "rapid-cortex-shared";
import { getUserContext, isUserAccountActive } from "../../lib/auth.js";

// ─── Environment ──────────────────────────────────────────────────────────────
const REGION = process.env.AWS_REGION ?? "us-east-1";
const SOURCES_TABLE = process.env.NEXIQ_INTEL_SOURCES_TABLE!;
const SOURCE_RUNS_TABLE = process.env.NEXIQ_INTEL_SOURCE_RUNS_TABLE!;
const DOCUMENTS_TABLE = process.env.NEXIQ_INTEL_DOCUMENTS_TABLE!;
const SIGNALS_TABLE = process.env.NEXIQ_INTEL_SIGNALS_TABLE!;
const GAPS_TABLE = process.env.NEXIQ_INTEL_GAPS_TABLE!;
const BENCHMARKS_TABLE = process.env.NEXIQ_INTEL_BENCHMARKS_TABLE!;
const COVERAGE_TABLE = process.env.NEXIQ_INTEL_COVERAGE_TABLE!;
const COLLECTOR_LAMBDA_NAME = process.env.NEXIQ_INTEL_COLLECTOR_LAMBDA_NAME!;

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
  marshallOptions: { removeUndefinedValues: true },
});
const lambdaClient = new LambdaClient({ region: REGION });

// ─── Auth helpers ─────────────────────────────────────────────────────────────
/**
 * Verify Cognito JWT via getUserContext and enforce RC sales-leads CRM access
 * (rcsuperadmin / rcadmin / rcitadmin / salescontractor).
 */
async function requireAdminAuth(
  event: APIGatewayProxyEventV2,
): Promise<{ userId: string; role: string } | null> {
  const user = await getUserContext(event);
  if (!user) return null;
  if (!isUserAccountActive(user)) return null;
  if (!canAccessSalesLeadsCrm(user.role)) return null;
  return { userId: user.userId, role: String(user.role) };
}

// ─── Response helpers ─────────────────────────────────────────────────────────
function ok(body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, data: body }),
  };
}

function created(body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, data: body }),
  };
}

function err(status: number, message: string): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ success: false, error: message }),
  };
}

function nanoid(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Buffer.from(bytes).toString("base64url").slice(0, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

// ─── Source Registry ──────────────────────────────────────────────────────────
async function listSources(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const qp = event.queryStringParameters ?? {};
  const health = qp.health;
  const vertical = qp.vertical;
  const enabled = qp.enabled;
  const limit = Math.min(parseInt(qp.limit ?? "100", 10), 500);

  let res;
  if (health) {
    // Use GSI for health-based queries
    res = await ddb.send(
      new QueryCommand({
        TableName: SOURCES_TABLE,
        IndexName: "health-nextScheduledCheckAt-index",
        KeyConditionExpression: "health = :h",
        ExpressionAttributeValues: { ":h": health },
        Limit: limit,
      }),
    );
  } else {
    res = await ddb.send(
      new ScanCommand({
        TableName: SOURCES_TABLE,
        Limit: limit,
      }),
    );
  }

  let sources = (res.Items ?? []) as IntelligenceSource[];

  if (vertical) {
    sources = sources.filter((s) => s.verticals.includes(vertical as IntelligenceSource["verticals"][0]));
  }
  if (enabled !== undefined) {
    sources = sources.filter((s) => s.enabled === (enabled === "true"));
  }

  // Sort: failing first, then by nextScheduledCheckAt
  sources.sort((a, b) => {
    const healthOrder: Record<string, number> = { FAILING: 0, DEGRADED: 1, HEALTHY: 2, DISABLED: 3 };
    const aOrder = healthOrder[a.health] ?? 4;
    const bOrder = healthOrder[b.health] ?? 4;
    return aOrder - bOrder;
  });

  return ok({ sources, total: sources.length });
}

async function getSource(sourceId: string): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new GetCommand({ TableName: SOURCES_TABLE, Key: { sourceId } }),
  );
  if (!res.Item) return err(404, "Source not found");
  return ok(res.Item as IntelligenceSource);
}

async function createSource(
  event: APIGatewayProxyEventV2,
  userId: string,
): Promise<APIGatewayProxyResultV2> {
  let body: CreateIntelligenceSourceRequest;
  try {
    body = JSON.parse(event.body ?? "{}") as CreateIntelligenceSourceRequest;
  } catch {
    return err(400, "Invalid JSON body");
  }

  if (!body.name || !body.url || !body.sourceType || !body.verticals?.length || !body.connectorType) {
    return err(400, "Missing required fields: name, url, sourceType, verticals, connectorType");
  }

  // Validate URL
  try {
    new URL(body.url);
  } catch {
    return err(400, "Invalid URL");
  }

  const now = nowIso();
  const sourceId = nanoid("isrc");

  const source: IntelligenceSource = {
    sourceId,
    name: body.name,
    organization: body.organization,
    url: body.url,
    domain: new URL(body.url).hostname,
    sourceType: body.sourceType,
    verticals: body.verticals,
    geography: body.geography,
    connectorType: body.connectorType,
    enabled: true,
    checkFrequencyMinutes: body.checkFrequencyMinutes ?? 120,
    consecutiveFailures: 0,
    health: "HEALTHY",
    documentLinkPattern: body.documentLinkPattern,
    notes: body.notes,
    addedBy: userId,
    nextScheduledCheckAt: now, // Schedule immediately
    createdAt: now,
    updatedAt: now,
  };

  await ddb.send(
    new PutCommand({
      TableName: SOURCES_TABLE,
      Item: source,
      ConditionExpression: "attribute_not_exists(sourceId)",
    }),
  );

  console.log(`[intel-api] Source created: ${sourceId} ${source.name} by ${userId}`);
  return created(source);
}

async function updateSource(
  sourceId: string,
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  let body: UpdateIntelligenceSourceRequest;
  try {
    body = JSON.parse(event.body ?? "{}") as UpdateIntelligenceSourceRequest;
  } catch {
    return err(400, "Invalid JSON body");
  }

  const res = await ddb.send(
    new GetCommand({ TableName: SOURCES_TABLE, Key: { sourceId } }),
  );
  if (!res.Item) return err(404, "Source not found");

  const updates: string[] = ["updatedAt = :upd"];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":upd": nowIso() };

  for (const [key, val] of Object.entries(body)) {
    if (val === undefined) continue;
    names[`#${key}`] = key;
    values[`:${key}`] = val;
    updates.push(`#${key} = :${key}`);
  }

  await ddb.send(
    new UpdateCommand({
      TableName: SOURCES_TABLE,
      Key: { sourceId },
      UpdateExpression: `SET ${updates.join(", ")}`,
      ExpressionAttributeNames: updates.length > 1 ? names : undefined,
      ExpressionAttributeValues: values,
    }),
  );

  const updated = await ddb.send(
    new GetCommand({ TableName: SOURCES_TABLE, Key: { sourceId } }),
  );
  return ok(updated.Item as IntelligenceSource);
}

async function disableSource(sourceId: string): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new GetCommand({ TableName: SOURCES_TABLE, Key: { sourceId } }),
  );
  if (!res.Item) return err(404, "Source not found");

  await ddb.send(
    new UpdateCommand({
      TableName: SOURCES_TABLE,
      Key: { sourceId },
      UpdateExpression: "SET enabled = :f, health = :h, updatedAt = :now",
      ExpressionAttributeValues: {
        ":f": false,
        ":h": "DISABLED",
        ":now": nowIso(),
      },
    }),
  );

  return ok({ sourceId, enabled: false, health: "DISABLED" });
}

async function triggerSourceRun(
  sourceId: string,
  userId: string,
): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new GetCommand({ TableName: SOURCES_TABLE, Key: { sourceId } }),
  );
  if (!res.Item) return err(404, "Source not found");

  // Invoke Collector Lambda async with the source ID
  const payload: IntelSchedulerEvent = {
    type: "SCHEDULED_SOURCE_CHECK",
    sourceId,
    triggeredBy: "MANUAL",
    triggeredByUserId: userId,
  };

  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: COLLECTOR_LAMBDA_NAME,
      InvocationType: "Event", // Async
      Payload: Buffer.from(JSON.stringify(payload)),
    }),
  );

  return ok({ sourceId, message: "Source run triggered. Check runs list for results." });
}

// ─── Source Runs ──────────────────────────────────────────────────────────────
async function listSourceRuns(sourceId: string, limit = 20): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: SOURCE_RUNS_TABLE,
      KeyConditionExpression: "sourceId = :s",
      ExpressionAttributeValues: { ":s": sourceId },
      ScanIndexForward: false, // Latest first
      Limit: limit,
    }),
  );

  return ok({ runs: res.Items ?? [], total: res.Count ?? 0 });
}

// ─── Documents ────────────────────────────────────────────────────────────────
async function listSourceDocuments(
  sourceId: string,
  limit = 50,
): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: DOCUMENTS_TABLE,
      IndexName: "sourceId-collectedAt-index",
      KeyConditionExpression: "sourceId = :s",
      ExpressionAttributeValues: { ":s": sourceId },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );

  return ok({ documents: res.Items ?? [], total: res.Count ?? 0 });
}

async function getDocument(docId: string): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new GetCommand({ TableName: DOCUMENTS_TABLE, Key: { docId } }),
  );
  if (!res.Item) return err(404, "Document not found");
  return ok(res.Item as IntelDocument);
}

// ─── Coverage Dashboard ───────────────────────────────────────────────────────
async function getCoverage(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const qp = event.queryStringParameters ?? {};
  const date = qp.date ?? new Date().toISOString().slice(0, 10);

  // Today's coverage snapshot
  const res = await ddb.send(
    new QueryCommand({
      TableName: COVERAGE_TABLE,
      KeyConditionExpression: "#d = :date",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: { ":date": date },
    }),
  );

  if (!res.Items?.length) {
    // Build a live snapshot from the source table
    const snapshot = await buildLiveCoverageSnapshot(date);
    return ok(snapshot);
  }

  // Return the latest stored snapshot for the day
  const snapshots = res.Items as IntelCoverageSnapshot[];
  const latest = snapshots.sort((a, b) => (b.hour ?? -1) - (a.hour ?? -1))[0];
  return ok(latest);
}

async function getCoverageHistory(days = 30): Promise<APIGatewayProxyResultV2> {
  const history: IntelCoverageSnapshot[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const res = await ddb.send(
      new QueryCommand({
        TableName: COVERAGE_TABLE,
        KeyConditionExpression: "#d = :date AND #h = :hour",
        ExpressionAttributeNames: { "#d": "date", "#h": "hour" },
        ExpressionAttributeValues: { ":date": dateStr, ":hour": -1 }, // Daily snapshots
      }),
    );

    if (res.Items?.[0]) {
      history.push(res.Items[0] as IntelCoverageSnapshot);
    }
  }

  return ok({ history });
}

async function buildLiveCoverageSnapshot(date: string): Promise<IntelCoverageSnapshot> {
  const [sourcesRes, signalsRes] = await Promise.all([
    ddb.send(new ScanCommand({
      TableName: SOURCES_TABLE,
      Select: "SPECIFIC_ATTRIBUTES",
      ProjectionExpression: "sourceId, health, enabled, verticals",
    })),
    ddb.send(new QueryCommand({
      TableName: SIGNALS_TABLE,
      IndexName: "vertical-detectedAt-index",
      KeyConditionExpression: "vertical = :v AND detectedAt >= :today",
      ExpressionAttributeValues: { ":v": "PSAP", ":today": `${date}T00:00:00.000Z` },
      Limit: 500,
    })),
  ]);

  const sources = (sourcesRes.Items ?? []) as Array<Pick<IntelligenceSource, "sourceId" | "health" | "enabled" | "verticals">>;

  const registeredSources = sources.length;
  const sourcesScheduled = sources.filter((s) => s.enabled).length;
  const sourcesSuccessful = sources.filter((s) => s.health === "HEALTHY").length;
  const sourcesFailed = sources.filter((s) => s.health === "FAILING").length;
  const sourcesDegraded = sources.filter((s) => s.health === "DEGRADED").length;
  const sourcesChecked = sourcesSuccessful + sourcesFailed + sourcesDegraded;

  const relevantSignals = (signalsRes.Count ?? 0);

  return {
    date,
    hour: -1,
    registeredSources,
    sourcesScheduled,
    sourcesChecked,
    sourcesSuccessful,
    sourcesFailed,
    sourcesDegraded,
    sourceSuccessRate: sourcesChecked > 0 ? (sourcesSuccessful / sourcesChecked) * 100 : 0,
    documentsDiscovered: 0, // Requires run aggregation
    newDocuments: 0,
    documentsProcessed: 0,
    processingFailures: 0,
    potentialSignals: 0,
    relevantSignals,
    qualifiedOpportunities: 0,
    highPriorityOpportunities: 0,
    byVertical: {
      PSAP: { sources: sources.filter((s) => s.verticals?.includes("PSAP")).length, signals: relevantSignals, opportunities: 0 },
      CAMPUS: { sources: sources.filter((s) => s.verticals?.includes("CAMPUS")).length, signals: 0, opportunities: 0 },
      TRANSIT: { sources: sources.filter((s) => s.verticals?.includes("TRANSIT")).length, signals: 0, opportunities: 0 },
      VENUE: { sources: sources.filter((s) => s.verticals?.includes("VENUE")).length, signals: 0, opportunities: 0 },
      COMPETITOR: { sources: sources.filter((s) => s.verticals?.includes("COMPETITOR")).length, signals: 0, opportunities: 0 },
    },
    createdAt: nowIso(),
  };
}

// ─── Discovery Gaps ───────────────────────────────────────────────────────────
async function listGaps(limit = 50): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(
    new ScanCommand({
      TableName: GAPS_TABLE,
      Limit: limit,
    }),
  );

  const gaps = (res.Items ?? []) as DiscoveryGap[];
  gaps.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  return ok({ gaps, total: gaps.length });
}

async function createGap(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  let body: Partial<DiscoveryGap>;
  try {
    body = JSON.parse(event.body ?? "{}") as Partial<DiscoveryGap>;
  } catch {
    return err(400, "Invalid JSON body");
  }

  if (!body.opportunityTitle || !body.orgName) {
    return err(400, "Missing required fields: opportunityTitle, orgName");
  }

  const gap: DiscoveryGap = {
    gapId: nanoid("igap"),
    orgId: body.orgId,
    orgName: body.orgName,
    opportunityTitle: body.opportunityTitle,
    opportunityUrl: body.opportunityUrl,
    solicitationNumber: body.solicitationNumber,
    externalDiscoverySource: body.externalDiscoverySource ?? "MANUAL",
    externalDiscoveryDetail: body.externalDiscoveryDetail,
    gapCategory: body.gapCategory ?? "UNKNOWN",
    gapAnalysis: body.gapAnalysis ?? "Pending analysis",
    recommendedRemediation: body.recommendedRemediation,
    sourceFound: false,
    documentCollected: false,
    detectedAt: nowIso(),
    autoRemediationBlocked: true,
    ttl: nowEpoch() + 365 * 24 * 60 * 60,
  };

  await ddb.send(
    new PutCommand({ TableName: GAPS_TABLE, Item: gap }),
  );

  return created(gap);
}

// ─── Benchmarks ───────────────────────────────────────────────────────────────
async function listBenchmarks(): Promise<APIGatewayProxyResultV2> {
  const res = await ddb.send(new ScanCommand({ TableName: BENCHMARKS_TABLE }));
  return ok({ benchmarks: res.Items ?? [], total: res.Count ?? 0 });
}

async function createBenchmark(
  event: APIGatewayProxyEventV2,
  userId: string,
): Promise<APIGatewayProxyResultV2> {
  let body: Partial<DiscoveryBenchmark>;
  try {
    body = JSON.parse(event.body ?? "{}") as Partial<DiscoveryBenchmark>;
  } catch {
    return err(400, "Invalid JSON body");
  }

  if (!body.organization || !body.title || !body.vertical || !body.expectedSignalType) {
    return err(400, "Missing required fields: organization, title, vertical, expectedSignalType");
  }

  const now = nowIso();
  const benchmark: DiscoveryBenchmark = {
    benchmarkId: nanoid("ibmk"),
    vertical: body.vertical,
    organization: body.organization,
    title: body.title,
    solicitationNumber: body.solicitationNumber,
    sourceUrl: body.sourceUrl,
    expectedSignalType: body.expectedSignalType,
    publicationDate: body.publicationDate,
    notes: body.notes,
    createdAt: now,
    updatedAt: now,
    addedBy: userId,
  };

  await ddb.send(
    new PutCommand({
      TableName: BENCHMARKS_TABLE,
      Item: benchmark,
      ConditionExpression: "attribute_not_exists(benchmarkId)",
    }),
  );

  return created(benchmark);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export const handler: Handler<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
> = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // Auth check — every route requires admin
  const user = await requireAdminAuth(event);
  if (!user) {
    return err(401, "Unauthorized");
  }

  try {
    // ── Source Registry ──────────────────────────────────────────────────────
    if (path === "/api/rc-admin/nexiq/intel/sources" && method === "GET") {
      return listSources(event);
    }
    if (path === "/api/rc-admin/nexiq/intel/sources" && method === "POST") {
      return createSource(event, user.userId);
    }

    const sourceMatch = path.match(/^\/api\/rc-admin\/nexiq\/intel\/sources\/([^/]+)$/);
    if (sourceMatch) {
      const [, sourceId] = sourceMatch;
      if (method === "GET") return getSource(sourceId!);
      if (method === "PATCH") return updateSource(sourceId!, event);
      if (method === "DELETE") return disableSource(sourceId!);
    }

    const runNowMatch = path.match(/^\/api\/rc-admin\/nexiq\/intel\/sources\/([^/]+)\/run$/);
    if (runNowMatch && method === "POST") {
      return triggerSourceRun(runNowMatch[1]!, user.userId);
    }

    const sourceRunsMatch = path.match(/^\/api\/rc-admin\/nexiq\/intel\/sources\/([^/]+)\/runs$/);
    if (sourceRunsMatch && method === "GET") {
      return listSourceRuns(sourceRunsMatch[1]!);
    }

    const sourceDocsMatch = path.match(/^\/api\/rc-admin\/nexiq\/intel\/sources\/([^/]+)\/documents$/);
    if (sourceDocsMatch && method === "GET") {
      return listSourceDocuments(sourceDocsMatch[1]!);
    }

    // ── Documents ────────────────────────────────────────────────────────────
    const docMatch = path.match(/^\/api\/rc-admin\/nexiq\/intel\/documents\/([^/]+)$/);
    if (docMatch && method === "GET") {
      return getDocument(docMatch[1]!);
    }

    // ── Coverage Dashboard ───────────────────────────────────────────────────
    if (path === "/api/rc-admin/nexiq/intel/coverage" && method === "GET") {
      return getCoverage(event);
    }
    if (path === "/api/rc-admin/nexiq/intel/coverage/history" && method === "GET") {
      const days = parseInt(event.queryStringParameters?.days ?? "30", 10);
      return getCoverageHistory(days);
    }

    // ── Discovery Gaps ───────────────────────────────────────────────────────
    if (path === "/api/rc-admin/nexiq/intel/gaps" && method === "GET") {
      return listGaps();
    }
    if (path === "/api/rc-admin/nexiq/intel/gaps" && method === "POST") {
      return createGap(event);
    }

    // ── Benchmarks ───────────────────────────────────────────────────────────
    if (path === "/api/rc-admin/nexiq/intel/benchmarks" && method === "GET") {
      return listBenchmarks();
    }
    if (path === "/api/rc-admin/nexiq/intel/benchmarks" && method === "POST") {
      return createBenchmark(event, user.userId);
    }

    return err(404, `Route not found: ${method} ${path}`);
  } catch (e: unknown) {
    console.error(`[intel-api] Unhandled error:`, e);
    return err(500, e instanceof Error ? e.message : "Internal server error");
  }
};
