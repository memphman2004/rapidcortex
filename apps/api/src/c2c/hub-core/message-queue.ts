import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { env } from "../../lib/env.js";

export interface QueuedMessage {
  id: string;
  targetAgencyId: string;
  payload: unknown;
  attempts: number;
}

const sqs = new SQSClient({});

export class MessageQueue {
  private pending: QueuedMessage[] = [];
  private dlq: QueuedMessage[] = [];
  private readonly delays = [1_000, 5_000, 30_000, 300_000];

  enqueue(targetAgencyId: string, payload: unknown): QueuedMessage {
    const msg: QueuedMessage = { id: crypto.randomUUID(), targetAgencyId, payload, attempts: 0 };
    this.pending.push(msg);
    const queueUrl = env.c2cInboundQueueUrl;
    if (queueUrl) {
      const tenantAgencyId =
        typeof payload === "object" && payload && "tenantAgencyId" in payload
          ? String((payload as { tenantAgencyId?: string }).tenantAgencyId ?? "")
          : targetAgencyId.split(":")[0] ?? "";
      void sqs
        .send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({
              targetAgencyId,
              tenantAgencyId,
              eido: typeof payload === "object" && payload && "eido" in payload ? (payload as { eido: unknown }).eido : payload,
            }),
          }),
        )
        .catch((error: unknown) => {
          console.warn(
            JSON.stringify({
              type: "c2c.queue.enqueue_failed",
              targetAgencyId,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        });
    }
    return msg;
  }

  retryOrDlq(msg: QueuedMessage): "retry" | "dlq" {
    msg.attempts += 1;
    if (msg.attempts >= this.delays.length) {
      this.dlq.push(msg);
      return "dlq";
    }
    this.pending.push(msg);
    return "retry";
  }

  delayFor(msg: QueuedMessage): number {
    return this.delays[Math.min(msg.attempts, this.delays.length - 1)] ?? 300_000;
  }

  drain(): QueuedMessage[] {
    const batch = this.pending;
    this.pending = [];
    return batch;
  }

  listDlq(): QueuedMessage[] {
    return [...this.dlq];
  }
}
