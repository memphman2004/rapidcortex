/**
 * Emit AI gate operational metrics to CloudWatch.
 * Dimensions tag every metric with AIMode so dashboards can compare
 * AI-active vs manual-mode performance side by side.
 */

import { CloudWatchClient, PutMetricDataCommand } from "@aws-sdk/client-cloudwatch";

const cw = new CloudWatchClient({});
const NAMESPACE = "NexCortIQ/AIGate";

export async function emitAIGateMetric(agencyId: string, aiEnabled: boolean): Promise<void> {
  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: NAMESPACE,
        MetricData: [
          {
            MetricName: "AIGateToggle",
            Value: 1,
            Unit: "Count",
            Dimensions: [
              { Name: "AgencyId", Value: agencyId },
              { Name: "NewAIMode", Value: aiEnabled ? "AI_ACTIVE" : "MANUAL" },
              { Name: "Environment", Value: process.env.DEPLOYMENT_STAGE ?? process.env.STAGE ?? "unknown" },
            ],
          },
        ],
      }),
    );
  } catch (err) {
    console.error(JSON.stringify({ msg: "ai_gate_metric_error", error: String(err) }));
  }
}

/**
 * Call from any AI-powered Lambda before Bedrock/Rekognition/Transcribe.
 * Tags the metric with the current AI mode for CloudWatch Insights splits.
 */
export async function emitOperationalMetric(params: {
  agencyId: string;
  metricName: string;
  value: number;
  unit?: "Milliseconds" | "Count" | "Percent";
  aiEnabled: boolean;
}): Promise<void> {
  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: "NexCortIQ/Operations",
        MetricData: [
          {
            MetricName: params.metricName,
            Value: params.value,
            Unit: params.unit ?? "Milliseconds",
            Dimensions: [
              { Name: "AgencyId", Value: params.agencyId },
              { Name: "AIMode", Value: params.aiEnabled ? "AI_ACTIVE" : "MANUAL" },
              {
                Name: "Environment",
                Value: process.env.DEPLOYMENT_STAGE ?? process.env.STAGE ?? "unknown",
              },
            ],
          },
        ],
      }),
    );
  } catch (err) {
    console.error(JSON.stringify({ msg: "ai_gate_ops_metric_error", error: String(err) }));
  }
}
