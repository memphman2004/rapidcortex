import type { SQSEvent, SQSHandler } from "aws-lambda";
import type { CadWebhookIngressMessage, CadWebhookQueueMessage } from "../../services/cad/cadWebhookProcessService.js";
import {
  processCadWebhookIngressMessage,
  processCadWebhookQueueMessage,
} from "../../services/cad/cadWebhookProcessService.js";

function decodeSqsBody(body: string): CadWebhookIngressMessage | CadWebhookQueueMessage | null {
  try {
    const outer = JSON.parse(body) as Record<string, unknown>;
    if (typeof outer.Message === "string" && outer.Type === "Notification") {
      return decodeSqsBody(outer.Message);
    }
    if (
      outer.v === 1 &&
      typeof outer.agencyId === "string" &&
      typeof outer.integrationId === "string" &&
      typeof outer.rawBody === "string" &&
      typeof outer.receivedAt === "string"
    ) {
      return outer as CadWebhookIngressMessage;
    }
    if (
      typeof outer.rawId === "string" &&
      typeof outer.agencyId === "string" &&
      typeof outer.integrationId === "string"
    ) {
      return outer as CadWebhookQueueMessage;
    }
  } catch {
    return null;
  }
  return null;
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const r of event.Records) {
    try {
      const decoded = decodeSqsBody(r.body ?? "{}");
      if (!decoded) continue;
      if ("v" in decoded && decoded.v === 1) {
        await processCadWebhookIngressMessage(decoded);
      } else {
        await processCadWebhookQueueMessage(decoded as CadWebhookQueueMessage);
      }
    } catch (e) {
      console.error(
        JSON.stringify({
          type: "cad.webhook.worker.error",
          message: e instanceof Error ? e.message : "unknown",
        }),
      );
      throw e;
    }
  }
};
