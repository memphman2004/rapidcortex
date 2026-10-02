/**
 * cad-poll-metrics.ts
 *
 * CloudWatch custom metrics for CAD API poll observability.
 *
 * Namespace: RapidCortex/CadPoller
 * Dimensions: {Vendor, AgencyId, IntegrationId}
 *
 * Metrics emitted per poll cycle:
 *   PollLatencyMs         — vendor API response time
 *   IncidentCount         — number of incidents returned
 *   PollSuccess           — 1 if ok, 0 if error
 *   AuthError             — 1 if 401/403 (triggers alert)
 *   CircuitBreakerOpen    — 1 if circuit opened this cycle
 *   RateLimit             — 1 if 429 received
 *
 * CloudWatch Alarms (recommended, not provisioned here):
 *   AuthError > 0 for 1 period → PagerDuty / ops alert
 *   PollSuccess < 1 for 3 periods → warning
 *   PollLatencyMs p99 > 10000 → vendor API degraded
 *
 * Uses PutMetricData in batches of 20 (CW limit).
 * Fails silently — metrics must never cause the poller to fail.
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
  type MetricDatum,
} from "@aws-sdk/client-cloudwatch";

const cw = new CloudWatchClient({});
const NAMESPACE = "RapidCortex/CadPoller";

export interface PollCycleMetrics {
  vendor: string;
  agencyId: string;
  integrationId: string;
  latencyMs: number;
  incidentCount: number;
  success: boolean;
  authError: boolean;
  circuitBreakerOpened: boolean;
  rateLimited: boolean;
}

function dim(name: string, value: string) {
  return { Name: name, Value: value };
}

export async function emitPollMetrics(m: PollCycleMetrics): Promise<void> {
  const now = new Date();
  const dims = [
    dim("Vendor", m.vendor),
    dim("AgencyId", m.agencyId),
    dim("IntegrationId", m.integrationId),
  ];

  const data: MetricDatum[] = [
    {
      MetricName: "PollLatencyMs",
      Dimensions: dims,
      Timestamp: now,
      Value: m.latencyMs,
      Unit: "Milliseconds",
    },
    {
      MetricName: "IncidentCount",
      Dimensions: dims,
      Timestamp: now,
      Value: m.incidentCount,
      Unit: "Count",
    },
    {
      MetricName: "PollSuccess",
      Dimensions: dims,
      Timestamp: now,
      Value: m.success ? 1 : 0,
      Unit: "Count",
    },
    {
      MetricName: "AuthError",
      Dimensions: dims,
      Timestamp: now,
      Value: m.authError ? 1 : 0,
      Unit: "Count",
    },
    {
      MetricName: "CircuitBreakerOpen",
      Dimensions: dims,
      Timestamp: now,
      Value: m.circuitBreakerOpened ? 1 : 0,
      Unit: "Count",
    },
    {
      MetricName: "RateLimit",
      Dimensions: dims,
      Timestamp: now,
      Value: m.rateLimited ? 1 : 0,
      Unit: "Count",
    },
  ];

  // CW accepts max 20 data points per call
  for (let i = 0; i < data.length; i += 20) {
    try {
      await cw.send(
        new PutMetricDataCommand({
          Namespace: NAMESPACE,
          MetricData: data.slice(i, i + 20),
        }),
      );
    } catch (e) {
      // Metrics must never crash the poller
      console.warn("[cad-poll-metrics] PutMetricData failed:", (e as Error).message);
    }
  }
}

/** Summary metric across all integrations per poll invocation */
export async function emitPollerSummary(opts: {
  totalIntegrations: number;
  polledCount: number;
  skippedCircuitOpen: number;
  skippedAuthError: number;
  totalIncidents: number;
  invocationDurationMs: number;
}): Promise<void> {
  const now = new Date();
  const data: MetricDatum[] = [
    { MetricName: "TotalIntegrations",   Timestamp: now, Value: opts.totalIntegrations,   Unit: "Count" },
    { MetricName: "PolledCount",          Timestamp: now, Value: opts.polledCount,          Unit: "Count" },
    { MetricName: "SkippedCircuitOpen",   Timestamp: now, Value: opts.skippedCircuitOpen,  Unit: "Count" },
    { MetricName: "SkippedAuthError",     Timestamp: now, Value: opts.skippedAuthError,    Unit: "Count" },
    { MetricName: "TotalIncidentsPolled", Timestamp: now, Value: opts.totalIncidents,       Unit: "Count" },
    { MetricName: "InvocationDurationMs", Timestamp: now, Value: opts.invocationDurationMs, Unit: "Milliseconds" },
  ];

  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: data,
      }),
    );
  } catch (e) {
    console.warn("[cad-poll-metrics] Summary PutMetricData failed:", (e as Error).message);
  }
}
