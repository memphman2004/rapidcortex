/**
 * Outgoing webhook identifiers for `/api/v1/webhooks/endpoints`.
 * Naming uses dot.case (Plaid/Stripe-compatible).
 */

export const RC_LITE_WEBHOOK_EVENTS = [
  "incident.analyzed",
  "risk_score.completed",
  "cad_export.ready",
  "cad_export.failed",
  "transcription.completed",
  "translation.completed",
  "caller_link.opened",
  "caller_media.uploaded",
  "qa_review.completed",
  "supervisor_flag.created",
] as const;

export type RcLiteWebhookEventKind = (typeof RC_LITE_WEBHOOK_EVENTS)[number];

export type RcLiteWebhookDeliveryPayloadBase = {
  id: string;
  type: RcLiteWebhookEventKind;
  apiVersion: "2026-04-28";
  created: string;
  tenantId: string;
};
