/**
 * DynamoDB-persisted circuit breaker for CAD API poll adapters.
 */

import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { CircuitBreakerState } from "./cad-poll-adapter.js";

const FAILURE_THRESHOLD = 3;
const INITIAL_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_COOLDOWN_MS = 30 * 60 * 1000;

export interface CircuitBreakerResult {
  allowed: boolean;
  state: CircuitBreakerState;
  reason?: string;
}

export function evaluateCircuitBreaker(cb: CircuitBreakerState | undefined): CircuitBreakerResult {
  if (!cb || cb.state === "CLOSED") {
    return { allowed: true, state: cb ?? { state: "CLOSED", failureCount: 0 } };
  }

  if (cb.state === "HALF_OPEN") {
    return { allowed: true, state: cb };
  }

  if (cb.state === "OPEN") {
    const cooldownUntil = new Date(cb.cooldownUntil).getTime();
    if (Date.now() >= cooldownUntil) {
      return {
        allowed: true,
        state: { state: "HALF_OPEN", failureCount: cb.failureCount, openedAt: cb.openedAt },
      };
    }
    const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    return { allowed: false, state: cb, reason: `Circuit OPEN — cooldown expires in ${remaining}s` };
  }

  return { allowed: true, state: { state: "CLOSED", failureCount: 0 } };
}

export function onSuccess(): CircuitBreakerState {
  return { state: "CLOSED", failureCount: 0 };
}

export function onFailure(current: CircuitBreakerState | undefined): CircuitBreakerState {
  const failureCount = (current?.failureCount ?? 0) + 1;

  if (failureCount < FAILURE_THRESHOLD && current?.state !== "HALF_OPEN") {
    return { state: "CLOSED", failureCount };
  }

  const now = new Date();
  const previousCooldownMs =
    current?.state === "OPEN"
      ? new Date(current.cooldownUntil).getTime() - new Date(current.openedAt).getTime()
      : INITIAL_COOLDOWN_MS;

  const cooldownMs = Math.min(
    current?.state === "HALF_OPEN" ? previousCooldownMs * 2 : INITIAL_COOLDOWN_MS,
    MAX_COOLDOWN_MS,
  );

  return {
    state: "OPEN",
    failureCount,
    openedAt: now.toISOString(),
    cooldownUntil: new Date(now.getTime() + cooldownMs).toISOString(),
  };
}

export function openImmediate(current: CircuitBreakerState | undefined): CircuitBreakerState {
  const now = new Date();
  return {
    state: "OPEN",
    failureCount: (current?.failureCount ?? 0) + 1,
    openedAt: now.toISOString(),
    cooldownUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

interface PersistOptions {
  ddb: DynamoDBDocumentClient;
  table: string;
  agencyId: string;
  integrationId: string;
  circuitBreaker: CircuitBreakerState;
  statusOverride?: "auth_error" | "active" | "error" | "testing";
  lastSuccessfulPollAt?: string;
  pollHistory?: Array<{ ts: string; ok: boolean; incidentCount: number; latencyMs: number }>;
}

export async function persistCircuitBreakerState(opts: PersistOptions): Promise<void> {
  const now = new Date().toISOString();
  let updateExpr = "SET #cb = :cb, #upd = :upd";
  const names: Record<string, string> = { "#cb": "circuitBreaker", "#upd": "updatedAt" };
  const values: Record<string, unknown> = { ":cb": opts.circuitBreaker, ":upd": now, ":a": opts.agencyId };

  if (opts.statusOverride) {
    updateExpr += ", #st = :st";
    names["#st"] = "status";
      values[":st"] = opts.statusOverride;
  }
  if (opts.lastSuccessfulPollAt) {
    updateExpr += ", #lsp = :lsp";
    names["#lsp"] = "lastSuccessfulPollAt";
    values[":lsp"] = opts.lastSuccessfulPollAt;
  }
  if (opts.pollHistory) {
    updateExpr += ", #ph = :ph";
    names["#ph"] = "pollHistory";
    values[":ph"] = opts.pollHistory;
  }

  await opts.ddb.send(
    new UpdateCommand({
      TableName: opts.table,
      Key: { id: opts.integrationId },
      ConditionExpression: "agencyId = :a",
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    }),
  );
}

export async function loadCircuitBreakerState(
  ddb: DynamoDBDocumentClient,
  table: string,
  agencyId: string,
  integrationId: string,
): Promise<CircuitBreakerState | undefined> {
  const result = await ddb.send(
    new GetCommand({
      TableName: table,
      Key: { id: integrationId },
      ProjectionExpression: "circuitBreaker, agencyId",
    }),
  );
  const item = result.Item as { agencyId?: string; circuitBreaker?: CircuitBreakerState } | undefined;
  if (!item || item.agencyId !== agencyId) return undefined;
  return item.circuitBreaker;
}
