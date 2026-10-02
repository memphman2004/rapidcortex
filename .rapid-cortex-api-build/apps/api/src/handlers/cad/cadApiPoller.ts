import type { ScheduledHandler } from "aws-lambda";
import { env } from "../../lib/env.js";
import { CadIntegrationRepository } from "../../repositories/cadIntegrationRepository.js";
import { evaluateCircuitBreaker } from "../../lib/cad/poll/cad-circuit-breaker.js";
import { emitPollerSummary } from "../../lib/cad/poll/cad-poll-metrics.js";
import { pollCadIntegration, shouldSkipDueToPollInterval } from "../../lib/cad/poll/cad-poller-service.js";
import type { CircuitBreakerState } from "../../lib/cad/poll/cad-poll-adapter.js";

const integrationRepo = new CadIntegrationRepository();

export const handler: ScheduledHandler = async () => {
  if (!env.cadIntegrationsTable || !env.cadWebhookIngressTopicArn) {
    console.log(JSON.stringify({ type: "cad.poller.skip", reason: "unconfigured" }));
    return;
  }

  const invocationStart = Date.now();
  const integrations = await integrationRepo.listApiPollIntegrations(80);
  console.log(JSON.stringify({ type: "cad.poller.start", integrations: integrations.length }));

  let polledCount = 0;
  let skippedPollInterval = 0;
  let skippedCircuitOpen = 0;
  let skippedAuthError = 0;
  let totalIncidents = 0;

  for (const record of integrations) {
    if (record.status === "auth_error") {
      skippedAuthError++;
      continue;
    }
    if (shouldSkipDueToPollInterval(record)) {
      skippedPollInterval++;
      continue;
    }
    const cb = record.circuitBreaker as CircuitBreakerState | undefined;
    const cbEval = evaluateCircuitBreaker(cb);
    if (!cbEval.allowed) {
      skippedCircuitOpen++;
      continue;
    }

    polledCount++;
    const outcome = await pollCadIntegration(record);
    if (!outcome.skipped) {
      totalIncidents += outcome.incidentCount;
    } else if (outcome.skipReason === "poll_interval") skippedPollInterval++;
    else if (outcome.skipReason === "circuit_open") skippedCircuitOpen++;
    else if (outcome.skipReason === "auth_error") skippedAuthError++;
  }

  await emitPollerSummary({
    totalIntegrations: integrations.length,
    polledCount,
    skippedCircuitOpen,
    skippedAuthError,
    totalIncidents,
    invocationDurationMs: Date.now() - invocationStart,
  });

  console.log(
    JSON.stringify({
      type: "cad.poller.done",
      polledCount,
      skippedPollInterval,
      skippedCircuitOpen,
      skippedAuthError,
      totalIncidents,
      durationMs: Date.now() - invocationStart,
    }),
  );
};
