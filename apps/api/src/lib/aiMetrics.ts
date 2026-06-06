/**
 * Structured logs consumed by CloudWatch metric filters / dashboards.
 * Do not log secrets or full model payloads.
 */
export function logAiMetric(event: {
  metric: string;
  value?: number;
  incidentId?: string;
  agencyId?: string;
  providerKind?: string;
  adapterName?: string;
  errorCode?: string;
  triggerType?: "manual" | "auto";
}): void {
  console.log(
    JSON.stringify({
      type: "ai.metric",
      ts: new Date().toISOString(),
      ...event,
    }),
  );
}
