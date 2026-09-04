import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { createHash } from "node:crypto";

const sqs = new SQSClient({});

export function intelWatchQueueUrl(): string {
  return process.env.INTEL_WATCH_QUEUE_URL?.trim() ?? "";
}

export async function enqueueIntelWatchJob(watchId: string): Promise<boolean> {
  const url = intelWatchQueueUrl();
  if (!url) return false;
  const day = new Date().toISOString().slice(0, 10);
  const dedupe = createHash("sha256").update(`${watchId}|${day}`).digest("hex").slice(0, 128);
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: url,
      MessageBody: JSON.stringify({ kind: "intel-watch", watchId }),
      MessageGroupId: watchId.slice(0, 128),
      MessageDeduplicationId: dedupe,
    }),
  );
  return true;
}
