/**
 * Scheduled DLQ review worker — peeks known dead-letter queues, emits
 * RapidCortex/DLQ metrics, and pages OpsAlerts when messages are present.
 *
 * Does not delete or replay messages. Optional HTTP replay stub returns 501.
 */

import type { APIGatewayProxyHandlerV2, ScheduledHandler } from "aws-lambda";
import {
  CloudWatchClient,
  PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import {
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const STAGE =
  process.env.DEPLOYMENT_STAGE ||
  process.env.STAGE ||
  process.env.DeploymentStage ||
  "dev";
const OPS_ALERTS_TOPIC_ARN = (process.env.OPS_ALERTS_TOPIC_ARN || "").trim();
const METRIC_NAMESPACE = "RapidCortex/DLQ";
const BODY_LOG_MAX = 120;

const sqs = new SQSClient({ region: REGION });
const cw = new CloudWatchClient({ region: REGION });
const sns = new SNSClient({ region: REGION });

/**
 * Fallback queue names discovered from infra SAM (QueueName / DLQ resources).
 * Prefer DLQ_QUEUE_NAMES env (comma-separated) when set at deploy time.
 */
function defaultDlqQueueNames(stage: string): string[] {
  return [
    `rapid-cortex-rapid-iq-pipeline-raw-signals-dlq-${stage}-v2.fifo`,
    `rapid-cortex-rapid-iq-intel-watch-dlq-${stage}-v2.fifo`,
    `rapid-cortex-unrouted-sms-${stage}`,
    `rc-invoice-jobs-dlq-${stage}.fifo`,
    `rapid-cortex-vision-scene-classify-dlq-${stage}`,
    `rapid-cortex-vision-scene-describe-dlq-${stage}`,
    `rapid-cortex-c2c-outbound-dlq-${stage}`,
    `rapid-cortex-c2c-inbound-dlq-${stage}`,
    `rapid-cortex-cad-bridge-events-dlq-${stage}.fifo`,
  ];
}

function resolveQueueNames(): string[] {
  const raw = (process.env.DLQ_QUEUE_NAMES || "").trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return defaultDlqQueueNames(STAGE);
}

function log(msg: string, extra?: Record<string, unknown>): void {
  console.log(JSON.stringify({ msg, stage: STAGE, ...extra }));
}

/** Truncate body; strip common secret-looking keys before any log use. */
function sanitizeBodyPreview(body: string | undefined): string {
  if (!body) return "";
  let text = body;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const key = k.toLowerCase();
      if (
        key.includes("password") ||
        key.includes("secret") ||
        key.includes("token") ||
        key.includes("authorization") ||
        key.includes("ssn") ||
        key.includes("phone") ||
        key.includes("email") ||
        key.includes("dob")
      ) {
        redacted[k] = "[REDACTED]";
      } else if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        redacted[k] = v;
      } else {
        redacted[k] = "[omitted]";
      }
    }
    text = JSON.stringify(redacted);
  } catch {
    /* keep raw truncated string */
  }
  return text.length > BODY_LOG_MAX ? `${text.slice(0, BODY_LOG_MAX)}…` : text;
}

async function putDlqMetric(queueName: string, count: number): Promise<void> {
  try {
    await cw.send(
      new PutMetricDataCommand({
        Namespace: METRIC_NAMESPACE,
        MetricData: [
          {
            MetricName: "DLQMessageCount",
            Dimensions: [{ Name: "QueueName", Value: queueName }],
            Unit: "Count",
            Value: count,
            Timestamp: new Date(),
          },
        ],
      }),
    );
  } catch (err) {
    log("dlq_metric_put_failed", {
      queueName,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function publishOpsAlert(queueName: string, count: number, previews: string[]): Promise<void> {
  if (!OPS_ALERTS_TOPIC_ARN) return;
  const subject = `[${STAGE}] DLQ messages: ${queueName}`;
  const previewBlock =
    previews.length > 0
      ? `\nMessage previews (truncated, redacted):\n${previews.map((p, i) => `  ${i + 1}. ${p}`).join("\n")}`
      : "";
  const body = [
    `NexCort iQ DLQ review detected messages on a dead-letter queue.`,
    `Stage: ${STAGE}`,
    `Queue: ${queueName}`,
    `Sampled message count (max 10): ${count}`,
    `Action: Investigate poison payloads; replay is not automated (HTTP stub returns 501).`,
    `Metric: ${METRIC_NAMESPACE} DLQMessageCount QueueName=${queueName}`,
    previewBlock,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sns.send(
      new PublishCommand({
        TopicArn: OPS_ALERTS_TOPIC_ARN,
        Subject: subject.slice(0, 100),
        Message: body,
      }),
    );
  } catch (err) {
    log("dlq_ops_alert_failed", {
      queueName,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

async function reviewOneQueue(queueName: string): Promise<{ queueName: string; count: number; ok: boolean }> {
  try {
    const urlRes = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
    const queueUrl = urlRes.QueueUrl;
    if (!queueUrl) {
      log("dlq_queue_url_missing", { queueName });
      await putDlqMetric(queueName, 0);
      return { queueName, count: 0, ok: false };
    }

    const recv = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 0,
        VisibilityTimeout: 30,
        MessageSystemAttributeNames: ["ApproximateReceiveCount"],
        MessageAttributeNames: ["All"],
      }),
    );

    const messages = recv.Messages ?? [];
    const count = messages.length;
    await putDlqMetric(queueName, count);

    const previews = messages.map((m) => sanitizeBodyPreview(m.Body));
    log("dlq_review", {
      queueName,
      count,
      messageIds: messages.map((m) => m.MessageId).filter(Boolean),
      // intentional: truncated/redacted only — never full bodies
      bodyPreviews: previews,
    });

    if (count > 0) {
      await publishOpsAlert(queueName, count, previews);
    }

    return { queueName, count, ok: true };
  } catch (err) {
    const code =
      err && typeof err === "object" && "name" in err
        ? String((err as { name?: string }).name)
        : undefined;
    // Queue may not exist in this account/stage — metric 0, continue others.
    if (code === "QueueDoesNotExist" || code === "AWS.SimpleQueueService.NonExistentQueue") {
      log("dlq_queue_absent", { queueName });
      await putDlqMetric(queueName, 0);
      return { queueName, count: 0, ok: true };
    }
    log("dlq_review_error", {
      queueName,
      err: err instanceof Error ? err.message : String(err),
      code,
    });
    return { queueName, count: 0, ok: false };
  }
}

export const checkDLQs: ScheduledHandler = async () => {
  const queues = resolveQueueNames();
  log("dlq_review_start", { queueCount: queues.length, hasOpsTopic: Boolean(OPS_ALERTS_TOPIC_ARN) });
  const results: Array<{ queueName: string; count: number; ok: boolean }> = [];
  for (const queueName of queues) {
    results.push(await reviewOneQueue(queueName));
  }
  const withMessages = results.filter((r) => r.count > 0);
  log("dlq_review_done", {
    reviewed: results.length,
    queuesWithMessages: withMessages.map((r) => ({ queueName: r.queueName, count: r.count })),
    failures: results.filter((r) => !r.ok).map((r) => r.queueName),
  });
};

/** SAM Handler entry — alias for checkDLQs. */
export const handler = checkDLQs;

/**
 * Optional HTTP replay stub — not wired for production replay.
 * Returns 501 until a deliberate replay path is implemented.
 */
export const replayDlqHttpStub: APIGatewayProxyHandlerV2 = async () => ({
  statusCode: 501,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    error: "not_implemented",
    message: "DLQ message replay is not implemented. Investigate and redrive manually from the SQS console or CLI.",
  }),
});
