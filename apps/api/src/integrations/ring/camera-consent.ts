import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import type { RingEmergencyCameraRequest } from "../../lib/ring-integration.js";
import { RingEmergencyRepository } from "../../repositories/ringEmergencyRepository.js";
import { provisionRingEmergencyKvsChannel } from "./ring-kvs.js";
import { consumeRingConsentRateSlot } from "./ring-consent-rate-limit.js";
import { auditRingEvent, AUDIT_EVENT_TYPES } from "./ring-audit.js";
import { ringHtml, ringJson } from "./ring-api-response.js";
import { configureRingEmergencyTables } from "./ring-tables.js";

const emergencyRepo = new RingEmergencyRepository();
const INVALID_LINK_MESSAGE = "This link is no longer valid.";

function clientIp(event: { requestContext?: { http?: { sourceIp?: string } } }): string {
  return event.requestContext?.http?.sourceIp?.trim() || "unknown";
}

async function findRequestByConsentToken(
  plainToken: string,
): Promise<RingEmergencyCameraRequest | null> {
  const candidates = await emergencyRepo.listSentRequestsNotExpired();
  for (const candidate of candidates) {
    const match = await bcrypt.compare(plainToken, candidate.requestTokenHash);
    if (match) return candidate;
  }
  return null;
}

function consentPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; color: #111; }
    .brand { font-weight: 700; letter-spacing: 0.02em; margin-bottom: 1rem; }
    .card { max-width: 32rem; padding: 1.25rem; border: 1px solid #e5e7eb; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="brand">Rapid Cortex</div>
  <div class="card"><p>${body}</p></div>
</body>
</html>`;
}

async function validateConsentToken(
  event: Parameters<APIGatewayProxyHandlerV2>[0],
  plainToken: string,
): Promise<RingEmergencyCameraRequest | "rate_limited" | null> {
  if (!plainToken) return null;
  const allowed = await consumeRingConsentRateSlot(clientIp(event));
  if (!allowed) return "rate_limited";

  const record = await findRequestByConsentToken(plainToken);
  if (!record) return null;
  if (record.usedAt) return null;
  if (new Date(record.expiresAt).getTime() <= Date.now()) return null;
  return record;
}

export const approveHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingEmergencyTables();
    const plainToken = event.pathParameters?.requestToken?.trim() ?? "";
    if (!plainToken) return ringJson({ success: false, error: INVALID_LINK_MESSAGE }, 400);

    const validated = await validateConsentToken(event, plainToken);
    if (validated === "rate_limited" || !validated) {
      return ringJson({ success: false, error: INVALID_LINK_MESSAGE }, 400);
    }

    const record = validated;
    const now = new Date();
    const nowIso = now.toISOString();
    const sessionId = randomUUID();
    const plainRevokeToken = randomBytes(32).toString("hex");
    const revokeTokenHash = await bcrypt.hash(plainRevokeToken, 12);
    const approvedDurationMinutes = record.requestedDurationMinutes;
    const expiresAt = new Date(
      now.getTime() + approvedDurationMinutes * 60 * 1000,
    ).toISOString();

    await emergencyRepo.updateRequest(record.agencyId, record.incidentId, record.requestId, {
      requestStatus: "APPROVED",
      approvedAt: nowIso,
      approvedDurationMinutes,
      usedAt: nowIso,
    });

    let streamProvider: string | null = null;
    let streamReference: string | null = null;
    let streamStatus: "PENDING" | "ACTIVE" = "PENDING";

    try {
      const kvs = await provisionRingEmergencyKvsChannel(sessionId);
      streamProvider = "kvs";
      streamReference = kvs.channelName;
      streamStatus = "ACTIVE";
    } catch (kvsErr) {
      console.error(
        JSON.stringify({
          msg: "ring_kvs_provision_failed",
          sessionId,
          agencyId: record.agencyId,
          incidentId: record.incidentId,
          error: kvsErr instanceof Error ? kvsErr.message : String(kvsErr),
        }),
      );
    }

    await emergencyRepo.putSession({
      sessionId,
      requestId: record.requestId,
      agencyId: record.agencyId,
      jurisdictionId: record.jurisdictionId,
      incidentId: record.incidentId,
      deviceId: record.deviceId,
      streamStatus,
      startedAt: nowIso,
      expiresAt,
      stoppedAt: null,
      stoppedBy: null,
      streamProvider,
      streamReference,
      revokeTokenHash,
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CAMERA_REQUEST_APPROVED,
      agencyId: record.agencyId,
      actorId: record.ringAccountId,
      details: {
        incidentId: record.incidentId,
        deviceId: record.deviceId,
        requestId: record.requestId,
        sessionId,
        approvedDurationMinutes,
      },
      resourceId: sessionId,
    });

    const html = consentPage(
      "Sharing approved",
      `Thank you. You have approved temporary emergency video sharing for ${approvedDurationMinutes} minutes. Emergency responders have been notified. You can stop sharing at any time using the link in your original message.`,
    );
    return ringHtml(html);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_camera_consent_approve_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: INVALID_LINK_MESSAGE }, 400);
  }
};

export const declineHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingEmergencyTables();
    const plainToken = event.pathParameters?.requestToken?.trim() ?? "";
    if (!plainToken) return ringJson({ success: false, error: INVALID_LINK_MESSAGE }, 400);

    const validated = await validateConsentToken(event, plainToken);
    if (validated === "rate_limited" || !validated) {
      return ringJson({ success: false, error: INVALID_LINK_MESSAGE }, 400);
    }

    const record = validated;
    const nowIso = new Date().toISOString();

    await emergencyRepo.updateRequest(record.agencyId, record.incidentId, record.requestId, {
      requestStatus: "DECLINED",
      declinedAt: nowIso,
      usedAt: nowIso,
    });

    await auditRingEvent({
      type: AUDIT_EVENT_TYPES.RING_CAMERA_REQUEST_DECLINED,
      agencyId: record.agencyId,
      actorId: record.ringAccountId,
      details: {
        incidentId: record.incidentId,
        deviceId: record.deviceId,
        requestId: record.requestId,
      },
      resourceId: record.requestId,
    });

    const html = consentPage(
      "Request declined",
      "You have declined the request. No video will be shared. Emergency responders have been notified of your decision.",
    );
    return ringHtml(html);
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_camera_consent_decline_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringJson({ success: false, error: INVALID_LINK_MESSAGE }, 400);
  }
};
