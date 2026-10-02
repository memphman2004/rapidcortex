import type { Handler } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { cadHealthMonitor } from "rapid-cortex-integrations/cad";
import { cadConnectorEnabled } from "./cadConnectorFlag.js";

/** EventBridge health sweep every 5 minutes. */
export const handler: Handler = async () => {
  if (!cadConnectorEnabled()) {
    return { skipped: true, reason: "disabled" };
  }
  const sweep = await cadHealthMonitor.sweep();
  const topic = process.env.CAD_CONNECTOR_OPS_TOPIC_ARN?.trim() || process.env.OPS_ALERTS_TOPIC_ARN?.trim();
  const alerts = sweep.changed.filter((c) => c.to === "degraded" || c.to === "unreachable" || c.to === "auth_failure");
  if (topic && alerts.length > 0) {
    const sns = new SNSClient({});
    await sns.send(
      new PublishCommand({
        TopicArn: topic,
        Subject: "CAD Connector health degraded",
        Message: JSON.stringify({ alerts }),
      }),
    );
  }
  return { checked: sweep.checks.length, changed: sweep.changed.length };
};
