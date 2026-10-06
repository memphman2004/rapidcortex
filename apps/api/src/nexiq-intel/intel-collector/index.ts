/**
 * NexiQ Intel — Collector Lambda
 * Target: apps/api/src/nexiq-intel/intel-collector/index.ts
 *
 * Triggered by:
 *   - EventBridge Scheduler (every 2 hours → checks sources due for a run)
 *   - Manual trigger via API (admin "Run Source Now")
 *   - Discovery reconciliation (targeted single-source re-fetch)
 *
 * Responsibilities:
 *   1. Query Source Registry for sources due for a check
 *   2. For each source: attempt fetch
 *   3. Create a SourceRun (telemetry) — regardless of success/failure
 *   4. Deduplicate discovered documents against fingerprint-index
 *   5. Write new IntelDocuments (COLLECTED status)
 *   6. Enqueue new docs to CollectionQueue for downstream processing
 *   7. Update Source health (HEALTHY/DEGRADED/FAILING)
 *
 * Critical: A zero-result SUCCESS is distinct from a FAILED run.
 * Both produce a SourceRun record. Do not conflate them.
 *
 * Does NOT: extract, classify, detect signals, or qualify.
 * Those are separate Lambda consumers of CollectionQueue.
 */

import type { EventBridgeEvent, Handler, SQSEvent } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
  type TransactWriteItem,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { createHash } from "node:crypto";

import type {
  IntelligenceSource,
  IntelSourceRun,
  IntelDocument,
  IntelSchedulerEvent,
  IntelProcessingMessage,
  IntelSourceRunStatus,
  IntelSourceHealth,
} from "rapid-cortex-shared";
import { enqueueRelevantPage } from "../../handlers/rapid-iq/pipeline/enqueue-crawled.js";
import { pipelineSourceIdForIntelSource } from "../pipeline-source.js";

// ─── Environment ──────────────────────────────────────────────────────────────
const REGION = process.env.AWS_REGION ?? "us-east-1";
const SOURCES_TABLE = process.env.NEXIQ_INTEL_SOURCES_TABLE!;
const SOURCE_RUNS_TABLE = process.env.NEXIQ_INTEL_SOURCE_RUNS_TABLE!;
const DOCUMENTS_TABLE = process.env.NEXIQ_INTEL_DOCUMENTS_TABLE!;
const COLLECTION_QUEUE_URL = process.env.NEXIQ_INTEL_COLLECTION_QUEUE_URL!;
const PROCESSING_QUEUE_URL = process.env.NEXIQ_INTEL_PROCESSING_QUEUE_URL!;
const RAW_ARTIFACTS_BUCKET = process.env.NEXIQ_INTEL_RAW_ARTIFACTS_BUCKET!;

/** Max sources to run per Lambda invocation (controls blast radius). */
const MAX_SOURCES_PER_RUN = parseInt(process.env.NEXIQ_INTEL_MAX_SOURCES_PER_RUN ?? "50", 10);

/** Consecutive failure threshold before marking FAILING. */
const FAILING_THRESHOLD = parseInt(process.env.NEXIQ_INTEL_FAILING_THRESHOLD ?? "5", 10);
const DEGRADED_THRESHOLD = parseInt(process.env.NEXIQ_INTEL_DEGRADED_THRESHOLD ?? "2", 10);

/** Max raw content size to store in DynamoDB (larger → S3). */
const MAX_INLINE_CONTENT_BYTES = 10_000;

/** Fetch timeout per source. */
const FETCH_TIMEOUT_MS = 15_000;

const ddbRaw = new DynamoDBClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(ddbRaw, {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({ region: REGION });
const sqs = new SQSClient({ region: REGION });

// ─── Helpers ─────────────────────────────────────────────────────────────────
function nowIso(): string {
  return new Date().toISOString();
}

function nowEpoch(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Generate 90-day TTL for SourceRun records.
 * Compliance data kept longer; run telemetry is rolling window.
 */
function runTtl(): number {
  return nowEpoch() + 90 * 24 * 60 * 60;
}

/**
 * Generate 365-day TTL for IntelDocument records.
 */
function docTtl(): number {
  return nowEpoch() + 365 * 24 * 60 * 60;
}

/**
 * Duplicate doc TTL: 90 days.
 */
function dupDocTtl(): number {
  return nowEpoch() + 90 * 24 * 60 * 60;
}

function nanoid(prefix: string): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const b64 = Buffer.from(bytes).toString("base64url").slice(0, 12);
  return `${prefix}-${b64}`;
}

/**
 * Deterministic document fingerprint.
 * Priority: normalized URL → solicitationNumber+org → title+org+date → content hash.
 * Multiple docs for the same opportunity share the same opportunity fingerprint
 * but have different document fingerprints.
 */
function fingerprintDocument(opts: {
  url: string;
  org?: string;
  solicitationNumber?: string;
  title?: string;
  publishedAt?: string;
  contentHash?: string;
}): string {
  const normalized = opts.url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .replace(/[?#].*/, "");

  const parts = [
    normalized,
    opts.org?.toLowerCase().trim() ?? "",
    opts.solicitationNumber?.toLowerCase().trim() ?? "",
    opts.title?.toLowerCase().trim().slice(0, 80) ?? "",
    opts.publishedAt?.slice(0, 10) ?? "",
    opts.contentHash ?? "",
  ];

  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/**
 * SSRF protection: reject private/loopback/reserved IP ranges.
 * Treat all external content as untrusted.
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    // Block localhost, loopback, private ranges
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      host.startsWith("172.16.") ||
      host.endsWith(".internal") ||
      host.endsWith(".local")
    ) {
      return false;
    }
    // Only allow http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ─── Source Fetching ──────────────────────────────────────────────────────────
interface FetchResult {
  ok: boolean;
  status?: number;
  text?: string;
  error?: string;
  errorCategory?: IntelSourceRun["failureCategory"];
  durationMs: number;
}

async function fetchSource(source: IntelligenceSource): Promise<FetchResult> {
  if (!isSafeUrl(source.url)) {
    return {
      ok: false,
      error: `Blocked URL: ${source.url} (SSRF protection)`,
      errorCategory: "INTERNAL_ERROR",
      durationMs: 0,
    };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "NexiQ-Intel/1.0 (+https://nexcortiq.us/intel)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    clearTimeout(timer);

    const durationMs = Date.now() - start;

    if (!res.ok) {
      const category: IntelSourceRun["failureCategory"] =
        res.status === 401 || res.status === 403
          ? "AUTH_REQUIRED"
          : res.status === 429
            ? "RATE_LIMITED"
            : "HTTP_ERROR";
      return {
        ok: false,
        status: res.status,
        error: `HTTP ${res.status}`,
        errorCategory: category,
        durationMs,
      };
    }

    const text = await res.text();

    // File-size limit: 5MB raw content
    if (text.length > 5_000_000) {
      return {
        ok: false,
        error: `Response too large: ${text.length} bytes`,
        errorCategory: "INTERNAL_ERROR",
        durationMs,
      };
    }

    return { ok: true, status: res.status, text, durationMs };
  } catch (e: unknown) {
    clearTimeout(timer);
    const durationMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout = msg.includes("abort") || msg.includes("timeout");
    return {
      ok: false,
      error: msg,
      errorCategory: isTimeout ? "NETWORK_TIMEOUT" : "INTERNAL_ERROR",
      durationMs,
    };
  }
}

// ─── Document Extraction from HTML ───────────────────────────────────────────
/**
 * Extract document links from raw HTML.
 * Minimal parsing — no script execution.
 * Full semantic extraction happens in the Processor Lambda via Bedrock.
 */
interface RawDocumentLink {
  url: string;
  title?: string;
  description?: string;
}

function extractDocumentLinks(
  html: string,
  baseUrl: string,
  source: IntelligenceSource,
): RawDocumentLink[] {
  const links: RawDocumentLink[] = [];
  const seen = new Set<string>();

  // Simple regex extraction — NOT using a full DOM parser for security
  const linkPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(html)) !== null) {
    const [, href, innerHtml] = match;
    if (!href) continue;

    // Resolve relative URLs
    let resolvedUrl: string;
    try {
      resolvedUrl = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    if (!isSafeUrl(resolvedUrl)) continue;
    if (seen.has(resolvedUrl)) continue;

    // Apply source-specific document link pattern if configured
    if (source.documentLinkPattern) {
      const pattern = new RegExp(source.documentLinkPattern, "i");
      if (!pattern.test(resolvedUrl)) continue;
    } else {
      // Default: only links that look like procurement documents
      if (
        !/\.(pdf|docx?|xlsx?|rtf|txt)(\?|$)/i.test(resolvedUrl) &&
        !/bid|rfp|rfq|rfi|solicitation|procurement|opportunity|contract|vendor/i.test(resolvedUrl)
      ) {
        continue;
      }
    }

    seen.add(resolvedUrl);

    // Strip HTML from inner text
    const title = innerHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    links.push({ url: resolvedUrl, title: title || undefined });
  }

  return links.slice(0, 200); // cap at 200 links per source per run
}

// ─── Deduplication ───────────────────────────────────────────────────────────
async function isDocumentDuplicate(
  fingerprint: string,
): Promise<{ isDup: boolean; existingDocId?: string }> {
  const res = await ddb.send(
    new QueryCommand({
      TableName: DOCUMENTS_TABLE,
      IndexName: "fingerprint-index",
      KeyConditionExpression: "fingerprint = :fp",
      ExpressionAttributeValues: { ":fp": fingerprint },
      Limit: 1,
    }),
  );

  const existing = res.Items?.[0];
  if (!existing) return { isDup: false };
  return { isDup: true, existingDocId: existing["docId"] as string };
}

// ─── Write SourceRun ─────────────────────────────────────────────────────────
async function writeSourceRun(run: IntelSourceRun): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: SOURCE_RUNS_TABLE,
      Item: run,
      // Append-only telemetry — never overwrite
      ConditionExpression: "attribute_not_exists(runId)",
    }),
  );
}

async function updateSourceRunCounts(
  sourceId: string,
  runId: string,
  delta: {
    documentsDiscovered?: number;
    newDocumentsFound?: number;
    documentsCollected?: number;
    documentsSkipped?: number;
    signalsDetected?: number;
    opportunitiesCreated?: number;
  },
): Promise<void> {
  const updates: string[] = [];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(delta)) {
    if (val === undefined) continue;
    names[`#${key}`] = key;
    values[`:${key}`] = val;
    updates.push(`#${key} = #${key} + :${key}`);
  }

  if (updates.length === 0) return;

  await ddb.send(
    new UpdateCommand({
      TableName: SOURCE_RUNS_TABLE,
      Key: { sourceId, runId },
      UpdateExpression: `ADD ${updates.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

// ─── Update Source Health ─────────────────────────────────────────────────────
async function updateSourceAfterRun(
  source: IntelligenceSource,
  runStatus: IntelSourceRunStatus,
  nextCheckAt: string,
): Promise<void> {
  const failed = runStatus === "FAILED" || runStatus === "TIMEOUT";
  const newFailures = failed ? (source.consecutiveFailures ?? 0) + 1 : 0;

  let health: IntelSourceHealth;
  if (!source.enabled) {
    health = "DISABLED";
  } else if (newFailures >= FAILING_THRESHOLD) {
    health = "FAILING";
  } else if (newFailures >= DEGRADED_THRESHOLD) {
    health = "DEGRADED";
  } else {
    health = "HEALTHY";
  }

  const now = nowIso();
  const updateExpr = failed
    ? `SET health = :health,
         consecutiveFailures = :failures,
         lastAttemptAt = :now,
         nextScheduledCheckAt = :next,
         updatedAt = :now`
    : `SET health = :health,
         consecutiveFailures = :failures,
         lastAttemptAt = :now,
         lastSuccessfulFetchAt = :now,
         nextScheduledCheckAt = :next,
         updatedAt = :now`;

  await ddb.send(
    new UpdateCommand({
      TableName: SOURCES_TABLE,
      Key: { sourceId: source.sourceId },
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: {
        ":health": health,
        ":failures": newFailures,
        ":now": now,
        ":next": nextCheckAt,
      },
    }),
  );
}

// ─── Store raw artifact in S3 ─────────────────────────────────────────────────
async function storeRawArtifact(
  sourceId: string,
  docId: string,
  content: string,
  ext: "html" | "txt" | "json",
): Promise<string> {
  const key = `raw/${sourceId}/${docId}.${ext}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: RAW_ARTIFACTS_BUCKET,
      Key: key,
      Body: content,
      ContentType: ext === "html" ? "text/html" : ext === "json" ? "application/json" : "text/plain",
      // Metadata for later reprocessing
      Metadata: {
        sourceId,
        docId,
        collectedAt: nowIso(),
      },
    }),
  );
  return key;
}

// ─── Enqueue documents for processing ────────────────────────────────────────
async function enqueueDocuments(docIds: string[], sourceId: string, runId: string): Promise<void> {
  if (docIds.length === 0) return;

  const BATCH_SIZE = 10;
  for (let i = 0; i < docIds.length; i += BATCH_SIZE) {
    const batch = docIds.slice(i, i + BATCH_SIZE);
    const entries = batch.map((docId, idx) => {
      const body: IntelProcessingMessage = {
        docId,
        sourceId,
        runId,
        stage: "EXTRACT",
        messageType: "PROCESS",
      };
      return {
        Id: String(idx),
        MessageBody: JSON.stringify(body),
        // Deduplicate SQS messages by docId
        MessageGroupId: sourceId,
        MessageDeduplicationId: docId,
      };
    });

    await sqs.send(
      new SendMessageBatchCommand({
        QueueUrl: PROCESSING_QUEUE_URL,
        Entries: entries,
      }),
    );
  }
}

// ─── Process a single source ──────────────────────────────────────────────────
async function processSource(
  source: IntelligenceSource,
  triggeredBy: IntelSourceRun["triggeredBy"],
  triggeredByUserId?: string,
): Promise<IntelSourceRun> {
  const runId = nanoid("irun");
  const startedAt = nowIso();
  const startMs = Date.now();

  console.log(`[intel-collector] Starting source check: ${source.sourceId} ${source.name} (${source.url})`);

  // Initialize run record
  const run: IntelSourceRun = {
    runId,
    sourceId: source.sourceId,
    status: "RUNNING",
    startedAt,
    documentsDiscovered: 0,
    newDocumentsFound: 0,
    documentsCollected: 0,
    documentsSkipped: 0,
    documentsFailedExtraction: 0,
    signalsDetected: 0,
    opportunitiesCreated: 0,
    triggeredBy,
    triggeredByUserId,
    ttl: runTtl(),
  };

  try {
    await writeSourceRun(run);
  } catch (e: unknown) {
    // Non-fatal: run may already exist (idempotency)
    console.warn(`[intel-collector] Failed to write initial SourceRun ${runId}:`, e);
  }

  // Fetch the source
  const fetchResult = await fetchSource(source);
  const durationMs = Date.now() - startMs;

  if (!fetchResult.ok || !fetchResult.text) {
    const failedRun: IntelSourceRun = {
      ...run,
      status: "FAILED",
      completedAt: nowIso(),
      durationMs,
      httpStatus: fetchResult.status,
      failureReason: fetchResult.error,
      failureCategory: fetchResult.errorCategory ?? "UNKNOWN",
      ttl: runTtl(),
    };

    await ddb.send(
      new UpdateCommand({
        TableName: SOURCE_RUNS_TABLE,
        Key: { sourceId: source.sourceId, runId },
        UpdateExpression:
          "SET #status = :status, completedAt = :c, durationMs = :d, httpStatus = :h, failureReason = :fr, failureCategory = :fc",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": failedRun.status,
          ":c": failedRun.completedAt,
          ":d": durationMs,
          ":h": fetchResult.status ?? 0,
          ":fr": fetchResult.error ?? "unknown",
          ":fc": fetchResult.errorCategory ?? "UNKNOWN",
        },
      }),
    );

    const nextCheckAt = new Date(
      Date.now() + source.checkFrequencyMinutes * 60 * 1000,
    ).toISOString();
    await updateSourceAfterRun(source, "FAILED", nextCheckAt);

    console.log(
      `[intel-collector] Source FAILED: ${source.sourceId} — ${fetchResult.error} (${durationMs}ms)`,
    );
    return failedRun;
  }

  // Extract document links from HTML
  const rawLinks = extractDocumentLinks(fetchResult.text, source.url, source);
  const discoveredCount = rawLinks.length;

  console.log(
    `[intel-collector] Source ${source.sourceId} fetched OK (${durationMs}ms). ` +
      `Discovered ${discoveredCount} candidate document links.`,
  );

  // Process each discovered document
  const newDocIds: string[] = [];
  const parserWarnings: string[] = [];

  for (const link of rawLinks) {
    const cHash = contentHash(link.url + (link.title ?? ""));
    const fp = fingerprintDocument({
      url: link.url,
      title: link.title,
      org: source.organization,
    });

    // Check deduplication
    const { isDup, existingDocId } = await isDocumentDuplicate(fp);

    if (isDup) {
      // Duplicate — record it but don't reprocess
      const dupDocId = nanoid("idoc");
      const dupDoc: IntelDocument = {
        docId: dupDocId,
        sourceId: source.sourceId,
        runId,
        status: "DUPLICATE",
        fingerprint: fp,
        isDuplicate: true,
        duplicateOfDocId: existingDocId,
        url: link.url,
        title: link.title,
        collectedAt: nowIso(),
        processingHistory: [
          { stage: "DUPLICATE", at: nowIso(), notes: `Duplicate of ${existingDocId}` },
        ],
        ttl: dupDocTtl(),
      };
      try {
        await ddb.send(new PutCommand({ TableName: DOCUMENTS_TABLE, Item: dupDoc }));
      } catch (e) {
        console.warn(`[intel-collector] Failed to write dup doc ${dupDocId}:`, e);
      }
      continue;
    }

    // New document — store it
    const docId = nanoid("idoc");
    const rawContentS3Key = fetchResult.text.length > MAX_INLINE_CONTENT_BYTES
      ? await storeRawArtifact(source.sourceId, docId, fetchResult.text, "html").catch(() => undefined)
      : undefined;

    const doc: IntelDocument = {
      docId,
      sourceId: source.sourceId,
      runId,
      status: "COLLECTED",
      fingerprint: fp,
      isDuplicate: false,
      url: link.url,
      title: link.title,
      organization: source.organization,
      description: link.description,
      rawContentS3Key,
      rawContentHash: cHash,
      rawContentLength: fetchResult.text.length,
      collectedAt: nowIso(),
      processingHistory: [
        {
          stage: "COLLECTED",
          at: nowIso(),
          durationMs: undefined,
          notes: `Collected from ${source.url}`,
        },
      ],
      ttl: docTtl(),
    };

    try {
      await ddb.send(
        new PutCommand({
          TableName: DOCUMENTS_TABLE,
          Item: doc,
          // Idempotent: if doc already exists (race condition), skip
          ConditionExpression: "attribute_not_exists(docId)",
        }),
      );
      newDocIds.push(docId);
    } catch (e: unknown) {
      if ((e as { name?: string }).name === "ConditionalCheckFailedException") {
        // Already exists — race condition, harmless
      } else {
        parserWarnings.push(`Failed to write doc ${docId}: ${e}`);
        console.warn(`[intel-collector] Failed to write doc ${docId}:`, e);
      }
    }
  }

  // Enqueue new docs for downstream processing
  if (newDocIds.length > 0) {
    await enqueueDocuments(newDocIds, source.sourceId, runId);
  }

  let pipelineSignalsQueued = 0;
  if (process.env.RAW_SIGNALS_QUEUE_URL?.trim()) {
    try {
      pipelineSignalsQueued = await enqueueRelevantPage(
        pipelineSourceIdForIntelSource(source),
        source.url,
        source.name,
        fetchResult.text,
        {
          agencyName: source.organization ?? source.name,
          state: source.geography?.state,
          intelSourceId: source.sourceId,
          intelRunId: runId,
        },
        8,
        { forcePage: true },
      );
    } catch (e: unknown) {
      console.warn(
        JSON.stringify({
          msg: "nexiq_intel_pipeline_enqueue_failed",
          sourceId: source.sourceId,
          error: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  }

  const completedAt = nowIso();
  const finalStatus: IntelSourceRunStatus = "SUCCESS";

  // Update run record
  await ddb.send(
    new UpdateCommand({
      TableName: SOURCE_RUNS_TABLE,
      Key: { sourceId: source.sourceId, runId },
      UpdateExpression:
        "SET #status = :status, completedAt = :c, durationMs = :d, httpStatus = :h, " +
        "documentsDiscovered = :disc, newDocumentsFound = :new_, documentsCollected = :coll, " +
        "documentsSkipped = :skip_, parserWarnings = :pw",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":status": finalStatus,
        ":c": completedAt,
        ":d": durationMs,
        ":h": fetchResult.status ?? 200,
        ":disc": discoveredCount,
        ":new_": newDocIds.length,
        ":coll": newDocIds.length,
        ":skip_": discoveredCount - newDocIds.length,
        ":pw": parserWarnings.length > 0 ? parserWarnings : undefined,
      },
    }),
  );

  const nextCheckAt = new Date(
    Date.now() + source.checkFrequencyMinutes * 60 * 1000,
  ).toISOString();
  await updateSourceAfterRun(source, finalStatus, nextCheckAt);

  console.log(
    `[intel-collector] Source SUCCESS: ${source.sourceId} — ` +
      `${discoveredCount} discovered, ${newDocIds.length} new, ` +
      `${discoveredCount - newDocIds.length} skipped (dups), ` +
      `${pipelineSignalsQueued} pipeline signals (${durationMs}ms)`,
  );

  return { ...run, status: finalStatus, completedAt, durationMs };
}

// ─── Fetch sources due for a check ───────────────────────────────────────────
async function getSourcesDueForCheck(limit: number): Promise<IntelligenceSource[]> {
  const now = nowIso();

  // Query health-nextScheduledCheckAt-index for HEALTHY and DEGRADED sources
  // that are due (nextScheduledCheckAt <= now)
  const [healthyRes, degradedRes] = await Promise.all([
    ddb.send(
      new QueryCommand({
        TableName: SOURCES_TABLE,
        IndexName: "health-nextScheduledCheckAt-index",
        KeyConditionExpression: "health = :h AND nextScheduledCheckAt <= :now",
        FilterExpression: "enabled = :t",
        ExpressionAttributeValues: {
          ":h": "HEALTHY",
          ":now": now,
          ":t": true,
        },
        Limit: limit,
      }),
    ),
    ddb.send(
      new QueryCommand({
        TableName: SOURCES_TABLE,
        IndexName: "health-nextScheduledCheckAt-index",
        KeyConditionExpression: "health = :h AND nextScheduledCheckAt <= :now",
        FilterExpression: "enabled = :t",
        ExpressionAttributeValues: {
          ":h": "DEGRADED",
          ":now": now,
          ":t": true,
        },
        Limit: Math.floor(limit / 4), // Degraded sources get fewer slots
      }),
    ),
  ]);

  const sources: IntelligenceSource[] = [
    ...(healthyRes.Items ?? []),
    ...(degradedRes.Items ?? []),
  ] as IntelligenceSource[];

  return sources.slice(0, limit);
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export const handler: Handler = async (event: unknown) => {
  console.log("[intel-collector] Invoked", JSON.stringify(event, null, 2));

  const typedEvent = event as Partial<IntelSchedulerEvent>;

  // Single source run (manual or targeted)
  if (typedEvent.type === "SCHEDULED_SOURCE_CHECK" && typedEvent.sourceId) {
    const sourceRes = await ddb.send(
      new GetCommand({
        TableName: SOURCES_TABLE,
        Key: { sourceId: typedEvent.sourceId },
      }),
    );

    if (!sourceRes.Item) {
      throw new Error(`Source not found: ${typedEvent.sourceId}`);
    }

    const source = sourceRes.Item as IntelligenceSource;
    const run = await processSource(
      source,
      typedEvent.triggeredBy ?? "MANUAL",
      typedEvent.triggeredByUserId,
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ runId: run.runId, status: run.status }),
    };
  }

  // Scheduled: run all sources due for a check
  const sources = await getSourcesDueForCheck(MAX_SOURCES_PER_RUN);

  console.log(`[intel-collector] Scheduled run: ${sources.length} sources due for check`);

  if (sources.length === 0) {
    console.log("[intel-collector] No sources due. Exiting cleanly.");
    return { processed: 0 };
  }

  // Process sources in parallel batches (max 5 concurrent HTTP fetches)
  const CONCURRENCY = 5;
  const results: Array<{ sourceId: string; status: string; error?: string }> = [];

  for (let i = 0; i < sources.length; i += CONCURRENCY) {
    const batch = sources.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(
      batch.map((s) => processSource(s, "SCHEDULER")),
    );

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      const s = batch[j]!;
      if (r.status === "fulfilled") {
        results.push({ sourceId: s.sourceId, status: r.value.status });
      } else {
        console.error(`[intel-collector] Unhandled error for ${s.sourceId}:`, r.reason);
        results.push({
          sourceId: s.sourceId,
          status: "FAILED",
          error: String(r.reason),
        });
      }
    }
  }

  const summary = {
    processed: results.length,
    successful: results.filter((r) => r.status === "SUCCESS").length,
    failed: results.filter((r) => r.status === "FAILED").length,
  };

  console.log("[intel-collector] Run complete:", summary);
  return summary;
};
