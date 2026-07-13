import type { APIGatewayProxyHandlerV2, APIGatewayProxyEventV2 } from "aws-lambda";
import {
  RING_HOMEOWNER_DEFAULT_AGENCY_ID,
  RingDeviceService,
  isRingEnabled,
  verifyRingWebhookSignature,
} from "../../lib/ring-integration.js";
import { configureRingEmergencyTables } from "./ring-tables.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringPublicJson } from "./ring-public-cors.js";

type RingWebhookPayload = {
  meta?: {
    version?: string;
    time?: string;
    request_id?: string;
    account_id?: string;
  };
  data?: {
    id?: string;
    type?: string;
    attributes?: {
      source?: string;
      source_type?: string;
      timestamp?: number;
    };
  };
};

function rawBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) return "";
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

function signatureHeader(event: APIGatewayProxyEventV2): string {
  const headers = event.headers ?? {};
  return (
    headers["x-signature"] ||
    headers["X-Signature"] ||
    headers["x-ring-signature"] ||
    headers["X-Ring-Signature"] ||
    ""
  ).trim();
}

function parsePayload(body: string): RingWebhookPayload | null {
  try {
    return JSON.parse(body) as RingWebhookPayload;
  } catch {
    return null;
  }
}

/**
 * Ring Appstore Webhook URL.
 * Ring POSTs signed event notifications; respond 200 within 5s after HMAC verify.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  configureRingEmergencyTables();

  if (event.requestContext?.http?.method === "OPTIONS") {
    return ringPublicJson(event, 204, "");
  }

  if (!isRingEnabled()) {
    return ringPublicJson(event, 503, { status: "error", error: "Ring Connect is not enabled." });
  }

  const body = rawBody(event);
  const signature = signatureHeader(event);

  if (!body || !signature) {
    return ringPublicJson(event, 401, { status: "error", error: "missing signature or body" });
  }

  let valid = false;
  try {
    valid = await verifyRingWebhookSignature(body, signature);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_webhook_signature_verify_error",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
    return ringPublicJson(event, 401, { status: "error", error: "signature verification failed" });
  }

  if (!valid) {
    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_WEBHOOK_SIGNATURE_FAILED,
      agencyId: "public",
      actorId: "ring-webhook",
      details: { flow: "appstore_webhook" },
    }).catch(() => undefined);
    return ringPublicJson(event, 401, { status: "error", error: "invalid signature" });
  }

  const payload = parsePayload(body);
  if (!payload) {
    // Ack to stop retries on corrupt payloads after a valid signature.
    return ringPublicJson(event, 200, { status: "ignored", reason: "invalid_json" });
  }

  const eventType = String(payload.data?.type ?? "").trim();
  const accountId = String(payload.meta?.account_id ?? "").trim();
  const requestId = String(payload.meta?.request_id ?? "").trim();
  const deviceId = String(payload.data?.attributes?.source ?? "").trim();
  const agencyId = RING_HOMEOWNER_DEFAULT_AGENCY_ID;

  await auditRingEvent({
    type: AUDIT_EVENT_TYPES.RING_WEBHOOK_RECEIVED,
    agencyId: agencyId || "public",
    actorId: accountId || "ring-webhook",
    details: {
      flow: "appstore_webhook",
      eventType,
      requestId,
      deviceId: deviceId || undefined,
      ringAccountId: accountId || undefined,
    },
    resourceId: requestId || deviceId || accountId || "webhook",
  }).catch((err) => {
    console.error(
      JSON.stringify({
        msg: "ring_webhook_audit_failed",
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  });

  try {
    const devices = new RingDeviceService();

    if (eventType === "device_removed" && deviceId && agencyId) {
      const updated = await devices.disableDeviceForConnectByAgency(agencyId, deviceId);
      console.info(
        JSON.stringify({
          msg: "ring_webhook_device_removed",
          requestId,
          deviceId,
          agencyId,
          found: Boolean(updated),
        }),
      );
    } else if (eventType === "app_integration_removed" && accountId && agencyId) {
      const updated = await devices.disableDevicesForRingAccount(agencyId, accountId);
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_ACCOUNT_UNLINKED,
        agencyId,
        actorId: accountId,
        details: {
          flow: "appstore_webhook",
          requestId,
          disabledDevices: updated.length,
        },
        resourceId: accountId,
      }).catch(() => undefined);
      console.info(
        JSON.stringify({
          msg: "ring_webhook_app_integration_removed",
          requestId,
          accountId,
          agencyId,
          disabledDevices: updated.length,
        }),
      );
    } else if (
      eventType === "device_added" ||
      eventType === "device_online" ||
      eventType === "device_offline" ||
      eventType === "motion_detected" ||
      eventType === "button_press"
    ) {
      console.info(
        JSON.stringify({
          msg: "ring_webhook_event_acked",
          eventType,
          requestId,
          accountId: accountId || undefined,
          deviceId: deviceId || undefined,
        }),
      );
    } else {
      console.info(
        JSON.stringify({
          msg: "ring_webhook_event_unknown",
          eventType: eventType || "missing",
          requestId,
        }),
      );
    }
  } catch (err) {
    // Prefer 200 after signature verify so Ring does not retry forever on our side bugs.
    console.error(
      JSON.stringify({
        msg: "ring_webhook_process_error",
        eventType,
        requestId,
        error: err instanceof Error ? err.message : "unknown",
      }),
    );
  }

  return ringPublicJson(event, 200, { status: "ok" });
};
