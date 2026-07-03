/**
 * Shared CAD API poll execution — used by scheduled Lambda and admin force-poll.
 */

import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { CadVendor } from "rapid-cortex-shared";
import { env } from "../../env.js";
import { ddb } from "../../../repositories/baseRepository.js";
import type { CadIntegrationRecord } from "../../../repositories/cadIntegrationRepository.js";
import type { CadWebhookIngressMessage } from "../../../services/cad/cadWebhookProcessService.js";
import {
  resolveConfig,
  type CadIntegrationConfig,
  type CircuitBreakerState,
  type PollHistoryPoint,
  type RawCadIncident,
} from "./cad-poll-adapter.js";
import {
  evaluateCircuitBreaker,
  onFailure,
  onSuccess,
  openImmediate,
  persistCircuitBreakerState,
} from "./cad-circuit-breaker.js";
import { getAdapter } from "./cad-poll-adapters.js";
import { emitPollMetrics } from "./cad-poll-metrics.js";

const DEFAULT_SINCE_HOURS = 24;
const DEDUP_TTL_DAYS = 7;
const MAX_POLL_HISTORY = 20;

const sns = new SNSClient({ region: env.region });

export interface PollOutcome {
  incidentCount: number;
  success: boolean;
  authError: boolean;
  circuitBreakerOpened: boolean;
  rateLimited: boolean;
  latencyMs: number;
  skipped?: boolean;
  skipReason?: string;
}

function configFromRecord(row: CadIntegrationRecord): CadIntegrationConfig {
  return (row.config ?? {}) as CadIntegrationConfig;
}

function circuitFromRecord(row: CadIntegrationRecord): CircuitBreakerState | undefined {
  return row.circuitBreaker as CircuitBreakerState | undefined;
}

function historyFromRecord(row: CadIntegrationRecord): PollHistoryPoint[] {
  return Array.isArray(row.pollHistory) ? (row.pollHistory as PollHistoryPoint[]) : [];
}

export function sinceIsoForIntegration(record: CadIntegrationRecord): string {
  const last = record.lastSuccessfulPollAt ?? record.lastIncidentAt;
  if (last && Date.parse(last)) return last;
  return new Date(Date.now() - DEFAULT_SINCE_HOURS * 60 * 60 * 1000).toISOString();
}

export function shouldSkipDueToPollInterval(record: CadIntegrationRecord): boolean {
  if (!record.lastSuccessfulPollAt) return false;
  const cfg = configFromRecord(record);
  const intervalMs = (cfg.pollIntervalMinutes ?? 2) * 60 * 1000;
  return Date.now() - new Date(record.lastSuccessfulPollAt).getTime() < intervalMs;
}

function appendPollHistory(prev: PollHistoryPoint[], point: PollHistoryPoint): PollHistoryPoint[] {
  return [...prev, point].slice(-MAX_POLL_HISTORY);
}

async function isDuplicate(agencyId: string, integrationId: string, cadEventId: string): Promise<boolean> {
  const table = env.cadWebhookIdempotencyTable?.trim();
  if (!table) return false;
  const dedupeKey = `poll:${agencyId}:${integrationId}:${cadEventId}`;
  const ttl = Math.floor(Date.now() / 1000) + DEDUP_TTL_DAYS * 86400;
  try {
    await ddb.send(
      new PutCommand({
        TableName: table,
        Item: { dedupeKey, responseJson: "{}", ttl },
        ConditionExpression: "attribute_not_exists(dedupeKey)",
      }),
    );
    return false;
  } catch (e: unknown) {
    if (e instanceof Error && e.name === "ConditionalCheckFailedException") return true;
    console.warn(JSON.stringify({ type: "cad.poller.dedup_error", message: e instanceof Error ? e.message : String(e) }));
    return false;
  }
}

async function publishToIngress(
  agencyId: string,
  integrationId: string,
  incident: RawCadIncident,
): Promise<void> {
  const topic = env.cadWebhookIngressTopicArn;
  if (!topic) return;

  const msg: CadWebhookIngressMessage = {
    v: 1,
    agencyId,
    integrationId,
    rawBody: JSON.stringify(incident.rawPayload),
    receivedAt: incident.receivedAt,
    contentType: "application/json",
  };

  await sns.send(
    new PublishCommand({
      TopicArn: topic,
      Message: JSON.stringify(msg),
    }),
  );
}

export async function pollCadIntegration(
  record: CadIntegrationRecord,
  opts?: { force?: boolean },
): Promise<PollOutcome> {
  const agencyId = record.agencyId;
  const integrationId = record.id;
  const vendor = record.vendor as CadVendor;
  const table = env.cadIntegrationsTable;
  const log = (msg: string) =>
    console.log(JSON.stringify({ type: "cad.poller.integration", agencyId, integrationId, vendor, msg }));

  if (!table) {
    return { incidentCount: 0, success: false, authError: false, circuitBreakerOpened: false, rateLimited: false, latencyMs: 0, skipped: true, skipReason: "no_table" };
  }

  if (record.status === "auth_error") {
    return { incidentCount: 0, success: false, authError: true, circuitBreakerOpened: false, rateLimited: false, latencyMs: 0, skipped: true, skipReason: "auth_error" };
  }

  if (!opts?.force && shouldSkipDueToPollInterval(record)) {
    return { incidentCount: 0, success: false, authError: false, circuitBreakerOpened: false, rateLimited: false, latencyMs: 0, skipped: true, skipReason: "poll_interval" };
  }

  const cbResult = evaluateCircuitBreaker(circuitFromRecord(record));
  if (!cbResult.allowed) {
    log(cbResult.reason ?? "circuit_open");
    return { incidentCount: 0, success: false, authError: false, circuitBreakerOpened: true, rateLimited: false, latencyMs: 0, skipped: true, skipReason: "circuit_open" };
  }

  const adapter = getAdapter(vendor);
  if (!adapter) {
    log(`no adapter for vendor ${vendor}`);
    return { incidentCount: 0, success: false, authError: false, circuitBreakerOpened: false, rateLimited: false, latencyMs: 0, skipped: true, skipReason: "no_adapter" };
  }

  if (env.cadPollerMock) {
    log("mock mode enabled");
  }

  let resolvedConfig;
  try {
    resolvedConfig = await resolveConfig(configFromRecord(record));
  } catch (e) {
    log(`credential resolution failed: ${e instanceof Error ? e.message : String(e)}`);
    const nextCb = onFailure(circuitFromRecord(record));
    await persistCircuitBreakerState({
      ddb,
      table,
      agencyId,
      integrationId,
      circuitBreaker: nextCb,
      statusOverride: "error",
    });
    return { incidentCount: 0, success: false, authError: false, circuitBreakerOpened: nextCb.state === "OPEN", rateLimited: false, latencyMs: 0 };
  }

  const sinceIso = sinceIsoForIntegration(record);
  const result = await adapter.poll(resolvedConfig, sinceIso);
  const now = new Date().toISOString();

  if (!result.ok) {
    const isAuth = result.errorType === "auth_error";
    const isRate = result.errorType === "rate_limited";
    const nextCb = isAuth ? openImmediate(circuitFromRecord(record)) : onFailure(circuitFromRecord(record));
    await persistCircuitBreakerState({
      ddb,
      table,
      agencyId,
      integrationId,
      circuitBreaker: nextCb,
      statusOverride: isAuth ? "auth_error" : undefined,
      pollHistory: appendPollHistory(historyFromRecord(record), {
        ts: now,
        ok: false,
        incidentCount: 0,
        latencyMs: result.latencyMs,
      }),
    });
    return {
      incidentCount: 0,
      success: false,
      authError: isAuth,
      circuitBreakerOpened: nextCb.state === "OPEN",
      rateLimited: isRate,
      latencyMs: result.latencyMs,
    };
  }

  let published = 0;
  for (const incident of result.incidents) {
    if (!incident.cadEventId) continue;
    if (await isDuplicate(agencyId, integrationId, incident.cadEventId)) continue;
    try {
      await publishToIngress(agencyId, integrationId, incident);
      published++;
    } catch (e) {
      log(`sns publish failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const nextSince = result.nextSince ?? now;
  await persistCircuitBreakerState({
    ddb,
    table,
    agencyId,
    integrationId,
    circuitBreaker: onSuccess(),
    lastSuccessfulPollAt: nextSince,
    statusOverride: record.status === "testing" ? "active" : undefined,
    pollHistory: appendPollHistory(historyFromRecord(record), {
      ts: now,
      ok: true,
      incidentCount: published,
      latencyMs: result.latencyMs,
    }),
  });

  void emitPollMetrics({
    vendor,
    agencyId,
    integrationId,
    latencyMs: result.latencyMs,
    incidentCount: published,
    success: true,
    authError: false,
    circuitBreakerOpened: false,
    rateLimited: false,
  });

  return {
    incidentCount: published,
    success: true,
    authError: false,
    circuitBreakerOpened: false,
    rateLimited: false,
    latencyMs: result.latencyMs,
  };
}
