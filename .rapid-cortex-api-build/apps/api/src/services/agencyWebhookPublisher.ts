import { env } from "../lib/env.js";
import { WebhookRepository, type WebhookRecord } from "../repositories/webhookRepository.js";
import { deliverSignedWebhook } from "./webhookDeliveryService.js";

const repo = new WebhookRepository();

export async function publishAgencyWebhooks(
  agencyId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!env.webhooksTable) return;
  let rows: WebhookRecord[] = [];
  try {
    rows = await repo.listByAgency(agencyId);
  } catch {
    return;
  }
  const targets = rows.filter(
    (r) => r.status === "active" && Array.isArray(r.eventTypes) && r.eventTypes.includes(eventType),
  );
  for (const r of targets) {
    try {
      const out = await deliverSignedWebhook(r, eventType, payload);
      await repo.patchDeliveryMeta(r.webhookId, r.agencyId, {
        lastDeliveryAt: new Date().toISOString(),
        failureCount: out.ok ? 0 : r.failureCount + 1,
      });
    } catch {
      await repo.patchDeliveryMeta(r.webhookId, r.agencyId, {
        lastDeliveryAt: new Date().toISOString(),
        failureCount: r.failureCount + 1,
      });
    }
  }
}
