import type { IntegrationDomainEvent } from "../normalized-events.js";

/**
 * Future: verify HMAC/signature, map vendor payload → `IntegrationDomainEvent[]`.
 */
export class WebhookEventIngressPlaceholder {
  readonly adapterId = "webhook-event-ingress-placeholder";

  parseInbound(_headers: Record<string, string>, _body: unknown): IntegrationDomainEvent[] {
    return [];
  }
}
