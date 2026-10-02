import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import type { DeceptionEvent } from "./deceptionEvent.js";
import { logDeceptionStructured } from "./deceptionLogger.js";

const sns = new SNSClient({});

function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return ip;
  const p = ip.split(".");
  if (p.length === 4) return `${p[0]}.${p[1]}.x.x`;
  return ip.length > 12 ? `${ip.slice(0, 8)}…` : ip;
}

export interface PagerDutyStub {
  /** Reserved for future PagerDuty Events API integration — not implemented. */
  enqueueCritical(_summary: string): Promise<void>;
}

export interface OpsgenieStub {
  /** Reserved for future Opsgenie integration — not implemented. */
  enqueueHigh(_summary: string): Promise<void>;
}

export const pagerDutyStub: PagerDutyStub = {
  async enqueueCritical() {
    /* intentionally empty */
  },
};

export const opsgenieStub: OpsgenieStub = {
  async enqueueHigh() {
    /* intentionally empty */
  },
};

/**
 * CloudWatch structured log + optional SNS to OpsAlertsTopic.
 * Never include raw bodies or Authorization-derived material.
 */
export async function sendSecurityAlert(event: DeceptionEvent): Promise<void> {
  const alertsOn = process.env.DECEPTION_ALERTS_ENABLED !== "false";
  const topicArn = process.env.OPS_ALERTS_TOPIC_ARN?.trim() ?? "";
  const slackUrl = process.env.DECEPTION_SLACK_WEBHOOK_URL?.trim() ?? "";

  const safePayload = {
    eventType: event.eventType,
    riskLevel: event.riskLevel,
    route: event.route,
    method: event.method,
    sourceIpMasked: maskIp(event.sourceIp),
    correlationId: event.correlationId,
    timestamp: event.createdAt,
    id: event.id,
    honeytokenUsed: event.honeytokenUsed ?? null,
  };

  logDeceptionStructured("deception.security_alert", safePayload);

  if (!alertsOn) return;

  if (topicArn && (event.riskLevel === "HIGH" || event.riskLevel === "CRITICAL")) {
    try {
      const subject =
        event.riskLevel === "CRITICAL"
          ? "CRITICAL: Deception Shield Alert"
          : "HIGH: Deception Shield Alert";
      const message = JSON.stringify(safePayload);
      await sns.send(
        new PublishCommand({
          TopicArn: topicArn,
          Subject: subject,
          Message: message,
        }),
      );
    } catch {
      logDeceptionStructured("deception.sns_publish_failed", { correlationId: event.correlationId });
    }
  }

  if (slackUrl && (event.riskLevel === "HIGH" || event.riskLevel === "CRITICAL")) {
    try {
      await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `*${event.riskLevel}* Deception Shield · ${event.eventType} · \`${event.method} ${event.route}\` · IP ${maskIp(event.sourceIp)} · \`${event.correlationId}\``,
        }),
      });
    } catch {
      logDeceptionStructured("deception.slack_webhook_failed", { correlationId: event.correlationId });
    }
  }
}
