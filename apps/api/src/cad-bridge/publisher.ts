import { createHash, randomUUID } from "node:crypto";
import type {
  BridgeEventType,
  BridgeOutcome,
  BufferedOutboundEvent,
  CADBridgeConfig,
  CADSlot,
  CanonicalIncident,
} from "rapid-cortex-shared";
import {
  BUFFER_TTL_SECONDS,
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  CIRCUIT_BREAKER_RESET_SECONDS,
  RC_BRIDGE_SOURCE_HEADER,
  buildBridgedCommentText,
} from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import type { CADAdapter } from "./adapters/base.js";
import { registerOutboundEvent, registerOutboundFingerprint, buildContentFingerprint } from "./loop-guard.js";
import { emitCadBridgeMetrics } from "./metrics.js";
import { resolveCadBridgeSecret } from "./secrets.js";
import { cadBridgeStore } from "./store.js";

export interface PublishInput {
  incident: CanonicalIncident;
  eventType: BridgeEventType;
  canonicalChanges: Partial<CanonicalIncident>;
  destinationSlot: CADSlot;
  destinationIncidentId: string | undefined;
  destAdapter: CADAdapter;
  config: CADBridgeConfig;
  isNewIncident: boolean;
  receivedAt: string;
}

export interface PublishResult {
  outcome: BridgeOutcome;
  createdIncidentId?: string;
  outboundPayloadHash?: string;
  errorCode?: string;
  errorDetail?: string;
}

interface BuiltOutbound {
  payload: Record<string, unknown>;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  skip?: boolean;
  errorDetail?: string;
}

export interface StoredDeliveryResult {
  outcome: "SUCCESS" | "FAILED" | "SKIPPED";
  retryable: boolean;
  errorCode?: string;
  errorDetail?: string;
  createdIncidentId?: string;
}

export async function publishCadBridgeEvent(input: PublishInput): Promise<PublishResult> {
  const destConfig = input.destinationSlot === "CAD_A" ? input.config.cadA : input.config.cadB;
  const built = await buildOutbound(input);
  if (built.skip) return { outcome: "SKIPPED", errorDetail: built.errorDetail };

  const payloadStr = JSON.stringify(built.payload);
  const outboundHash = buildContentFingerprint(payloadStr);
  await registerOutboundFingerprint(input.incident.agencyId, randomUUID(), payloadStr);

  const cb = await cadBridgeStore.getCircuitBreaker(input.incident.agencyId, input.destinationSlot);
  if (cb?.state === "OPEN") {
    const openedAt = cb.openedAt ? Date.parse(cb.openedAt) : 0;
    if (Date.now() - openedAt <= CIRCUIT_BREAKER_RESET_SECONDS * 1000) {
      await bufferBuilt(input, built);
      return { outcome: "BUFFERED", errorCode: "CIRCUIT_OPEN", outboundPayloadHash: outboundHash };
    }
    await cadBridgeStore.putCircuitBreaker({
      agencyId: input.incident.agencyId,
      cadSlot: input.destinationSlot,
      state: "HALF_OPEN",
      failureCount: 0,
    });
  }

  if (env.cadBridgeMock) {
    await recordSuccess(input.incident.agencyId, input.destinationSlot);
    await emitLag(input);
    return {
      outcome: "SUCCESS",
      createdIncidentId: input.isNewIncident
        ? `MOCK-${input.destinationSlot}-${randomUUID().slice(0, 8)}`
        : undefined,
      outboundPayloadHash: outboundHash,
    };
  }

  if (!env.cadWritebackEnabled) {
    return {
      outcome: "SKIPPED",
      outboundPayloadHash: outboundHash,
      errorCode: "WRITEBACK_DISABLED",
      errorDetail: "CAD write-back is fail-closed; partner CAD was not called",
    };
  }

  const apiKey = await resolveCadBridgeSecret(destConfig.apiKeySecretArn, "apiKey");
  let lastError: { code: string; detail: string } | null = null;

  for (let attempt = 1; attempt <= destConfig.retryAttempts; attempt++) {
    try {
      const response = await postToCad({
        endpoint: built.endpoint,
        method: built.method,
        payloadStr,
        apiKey,
        timeoutMs: destConfig.timeoutMs,
        agencyId: input.incident.agencyId,
      });
      if (response.ok) {
        await recordSuccess(input.incident.agencyId, input.destinationSlot);
        await emitLag(input);
        let createdIncidentId: string | undefined;
        if (input.isNewIncident && input.eventType === "INCIDENT_CREATED") {
          try {
            const body = (await response.json()) as Record<string, unknown>;
            createdIncidentId = input.destAdapter.extractCreatedIncidentId(body);
          } catch {
            console.warn("[cad-bridge.publisher] could not extract created incident id");
          }
        }
        return { outcome: "SUCCESS", createdIncidentId, outboundPayloadHash: outboundHash };
      }
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        await emitCadBridgeMetrics({
          agencyId: input.incident.agencyId,
          cadSlot: input.destinationSlot,
          failedPublishCount: 1,
          cadConnected: false,
        });
        return {
          outcome: "FAILED",
          outboundPayloadHash: outboundHash,
          errorCode: `HTTP_${response.status}`,
          errorDetail: "Non-retriable error from destination CAD",
        };
      }
      lastError = { code: `HTTP_${response.status}`, detail: `Destination CAD returned ${response.status}` };
    } catch (err) {
      lastError = { code: "NETWORK_ERROR", detail: err instanceof Error ? err.message : "unknown" };
    }
    if (attempt < destConfig.retryAttempts) {
      await sleep(Math.min(destConfig.retryBackoffMs * 2 ** (attempt - 1), 30_000));
    }
  }

  await recordFailure(input.incident.agencyId, input.destinationSlot);
  await bufferBuilt(input, built);
  await emitCadBridgeMetrics({
    agencyId: input.incident.agencyId,
    cadSlot: input.destinationSlot,
    failedPublishCount: 1,
    cadConnected: false,
  });
  return {
    outcome: "BUFFERED",
    outboundPayloadHash: outboundHash,
    errorCode: lastError?.code,
    errorDetail: lastError?.detail,
  };
}

/**
 * Replay a previously buffered outbound event. Posts the stored payload as-is.
 * Does not re-translate canonical fields.
 */
export async function deliverStoredOutboundEvent(opts: {
  event: BufferedOutboundEvent;
  config: CADBridgeConfig;
}): Promise<StoredDeliveryResult> {
  const destConfig = opts.event.destinationSlot === "CAD_A" ? opts.config.cadA : opts.config.cadB;
  if (!opts.event.endpoint || !opts.event.method) {
    return { outcome: "FAILED", retryable: false, errorCode: "MISSING_STORED_ENDPOINT" };
  }

  const payloadStr = JSON.stringify(opts.event.outboundPayload);
  await registerOutboundFingerprint(opts.event.agencyId, opts.event.eventId, payloadStr);

  if (env.cadBridgeMock) {
    await recordSuccess(opts.event.agencyId, opts.event.destinationSlot);
    return { outcome: "SUCCESS", retryable: false };
  }
  if (!env.cadWritebackEnabled) {
    return {
      outcome: "SKIPPED",
      retryable: false,
      errorCode: "WRITEBACK_DISABLED",
      errorDetail: "CAD write-back is fail-closed; partner CAD was not called",
    };
  }

  try {
    const apiKey = await resolveCadBridgeSecret(destConfig.apiKeySecretArn, "apiKey");
    const response = await postToCad({
      endpoint: opts.event.endpoint,
      method: opts.event.method,
      payloadStr,
      apiKey,
      timeoutMs: destConfig.timeoutMs,
      agencyId: opts.event.agencyId,
    });
    if (response.ok) {
      await recordSuccess(opts.event.agencyId, opts.event.destinationSlot);
      return { outcome: "SUCCESS", retryable: false };
    }
    const retryable = response.status !== 400 && response.status !== 401 && response.status !== 403;
    if (!retryable) {
      await emitCadBridgeMetrics({
        agencyId: opts.event.agencyId,
        cadSlot: opts.event.destinationSlot,
        failedPublishCount: 1,
        cadConnected: false,
      });
    }
    return {
      outcome: "FAILED",
      retryable,
      errorCode: `HTTP_${response.status}`,
      errorDetail: `Destination CAD returned ${response.status}`,
    };
  } catch (err) {
    return {
      outcome: "FAILED",
      retryable: true,
      errorCode: "NETWORK_ERROR",
      errorDetail: err instanceof Error ? err.message : "unknown",
    };
  }
}

async function buildOutbound(input: PublishInput): Promise<BuiltOutbound> {
  const destConfig = input.destinationSlot === "CAD_A" ? input.config.cadA : input.config.cadB;
  const endpoints = input.destAdapter.getEndpoints();
  const destId = input.destinationIncidentId ?? "";

  if (input.isNewIncident && input.eventType === "INCIDENT_CREATED") {
    return {
      payload: input.destAdapter.buildCreatePayload(input.incident),
      endpoint: `${destConfig.baseUrl}${endpoints.createIncident}`,
      method: "POST",
    };
  }
  if (input.eventType === "COMMENT_ADDED") {
    const comments = input.canonicalChanges.comments ?? [];
    if (!comments.length) return { payload: {}, endpoint: "", method: "POST", skip: true, errorDetail: "No comment" };
    const tagged = [];
    for (const comment of comments) {
      const eventId = randomUUID();
      const fingerprint = createHash("sha256").update(comment.text).digest("hex");
      const bridgeToken = await registerOutboundEvent(input.incident.agencyId, eventId, fingerprint);
      tagged.push({
        ...comment,
        text: buildBridgedCommentText(comment.text, bridgeToken),
        rcBridgeToken: bridgeToken,
        isBridged: true,
      });
    }
    return {
      payload: input.destAdapter.buildCommentPayload(destId, tagged[0]!),
      endpoint: `${destConfig.baseUrl}${endpoints.addComment.replace("{id}", destId)}`,
      method: "POST",
    };
  }
  if (input.eventType === "INCIDENT_CLOSED" || input.eventType === "INCIDENT_CANCELLED") {
    return {
      payload: input.destAdapter.buildClosePayload(
        destId,
        input.eventType === "INCIDENT_CLOSED" ? "CLOSED" : "CANCELLED",
      ),
      endpoint: `${destConfig.baseUrl}${endpoints.closeIncident.replace("{id}", destId)}`,
      method: "PUT",
    };
  }
  return {
    payload: input.destAdapter.buildUpdatePayload(destId, input.canonicalChanges, input.eventType),
    endpoint: `${destConfig.baseUrl}${endpoints.updateIncident.replace("{id}", destId)}`,
    method: "PUT",
  };
}

async function bufferBuilt(input: PublishInput, built: BuiltOutbound): Promise<void> {
  if (!built.endpoint) return;
  const now = new Date().toISOString();
  const buffered: BufferedOutboundEvent = {
    eventId: randomUUID(),
    agencyId: input.incident.agencyId,
    destinationSlot: input.destinationSlot,
    rcIncidentId: input.incident.rcIncidentId,
    eventType: input.eventType,
    outboundPayload: built.payload,
    endpoint: built.endpoint,
    method: built.method,
    queuedAt: now,
    attemptCount: 0,
    expiresAt: Math.floor(Date.now() / 1000) + BUFFER_TTL_SECONDS,
  };
  await cadBridgeStore.putBuffer(buffered);
  const pending = await cadBridgeStore.countBuffered(input.incident.agencyId);
  await emitCadBridgeMetrics({
    agencyId: input.incident.agencyId,
    cadSlot: input.destinationSlot,
    pendingBufferSize: pending,
  });
}

async function postToCad(opts: {
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  payloadStr: string;
  apiKey: string;
  timeoutMs: number;
  agencyId: string;
}): Promise<Response> {
  return fetchWithTimeout(
    opts.endpoint,
    {
      method: opts.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        "X-RC-Bridge-Source": RC_BRIDGE_SOURCE_HEADER,
        "X-RC-Agency-Id": opts.agencyId,
      },
      body: opts.payloadStr,
    },
    opts.timeoutMs,
  );
}

async function recordFailure(agencyId: string, slot: CADSlot): Promise<void> {
  try {
    const count = await cadBridgeStore.incrementCircuitFailure(agencyId, slot);
    if (count >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
      await cadBridgeStore.putCircuitBreaker({
        agencyId,
        cadSlot: slot,
        state: "OPEN",
        failureCount: count,
        openedAt: new Date().toISOString(),
      });
    }
  } catch {
    // Circuit state is best-effort.
  }
}

async function recordSuccess(agencyId: string, slot: CADSlot): Promise<void> {
  try {
    await cadBridgeStore.putCircuitBreaker({
      agencyId,
      cadSlot: slot,
      state: "CLOSED",
      failureCount: 0,
    });
    await emitCadBridgeMetrics({ agencyId, cadSlot: slot, cadConnected: true });
  } catch {
    // best-effort
  }
}

async function emitLag(input: PublishInput): Promise<void> {
  const lag = Math.max(0, Date.now() - Date.parse(input.receivedAt));
  await emitCadBridgeMetrics({
    agencyId: input.incident.agencyId,
    cadSlot: input.destinationSlot,
    syncLagMs: lag,
  });
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
