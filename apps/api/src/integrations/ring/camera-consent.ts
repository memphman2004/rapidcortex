import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes, randomUUID } from "node:crypto";
import * as bcrypt from "bcryptjs";
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function findRequestByStopToken(
  plainToken: string,
): Promise<RingEmergencyCameraRequest | null> {
  const statuses = ["SENT", "OPENED", "APPROVED"] as const;
  for (const status of statuses) {
    const candidates = await emergencyRepo.listRequestsByStatus(status);
    for (const candidate of candidates) {
      const hash = candidate.stopTokenHash;
      if (!hash) continue;
      const match = await bcrypt.compare(plainToken, hash);
      if (match) return candidate;
    }
  }
  return null;
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
    // Prefer stop token from original SMS so STOP SHARING link keeps working after approve.
    const plainRevokeToken = randomBytes(32).toString("hex");
    const revokeTokenHash = record.stopTokenHash
      ? record.stopTokenHash
      : await bcrypt.hash(plainRevokeToken, 12);
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
      `Thank you. You have approved temporary emergency video sharing for ${approvedDurationMinutes} minutes with ${escapeHtml(record.deviceName)}. Emergency responders have been notified. You can stop sharing at any time using the STOP SHARING link in your original SMS.`,
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

const TERMINAL_SESSION_STATUSES = new Set(["STOPPED", "EXPIRED", "ERROR"]);

/**
 * Owner STOP SHARING from the original SMS — works before approve (cancels) or after (revokes session).
 */
export const stopHandler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    configureRingEmergencyTables();
    const plainToken = event.pathParameters?.requestToken?.trim() ?? "";
    if (!plainToken) {
      return ringHtml(consentPage("Link invalid", INVALID_LINK_MESSAGE), 400);
    }

    const allowed = await consumeRingConsentRateSlot(clientIp(event));
    if (!allowed) {
      return ringHtml(consentPage("Too many requests", "Please wait a moment and try again."), 429);
    }

    const record = await findRequestByStopToken(plainToken);
    if (!record) {
      return ringHtml(consentPage("Link invalid", INVALID_LINK_MESSAGE), 400);
    }

    const nowIso = new Date().toISOString();

    if (record.requestStatus === "SENT" || record.requestStatus === "OPENED") {
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
          via: "owner_stop_sms",
        },
        resourceId: record.requestId,
      });
      return ringHtml(
        consentPage(
          "Request stopped",
          "You have stopped this request. No video will be shared. Emergency responders have been notified.",
        ),
      );
    }

    if (record.requestStatus === "APPROVED") {
      const sessions = await emergencyRepo.listSessionsForIncident(
        record.agencyId,
        record.incidentId,
      );
      const session = sessions.find(
        (s) => s.requestId === record.requestId && !TERMINAL_SESSION_STATUSES.has(s.streamStatus),
      );
      if (session) {
        await emergencyRepo.updateSession(session.sessionId, session.createdAt, {
          streamStatus: "STOPPED",
          stoppedAt: nowIso,
          stoppedBy: "OWNER",
          updatedAt: nowIso,
        });
      }
      await emergencyRepo.updateRequest(record.agencyId, record.incidentId, record.requestId, {
        requestStatus: "REVOKED",
        revokedAt: nowIso,
      });
      await auditRingEvent({
        type: AUDIT_EVENT_TYPES.RING_CAMERA_SESSION_REVOKED,
        agencyId: record.agencyId,
        actorId: "OWNER",
        details: {
          incidentId: record.incidentId,
          deviceId: record.deviceId,
          requestId: record.requestId,
          sessionId: session?.sessionId,
          via: "owner_stop_sms",
        },
        resourceId: session?.sessionId ?? record.requestId,
      });
      return ringHtml(
        consentPage(
          "Sharing stopped",
          "Live video sharing has been stopped. Emergency responders can no longer view your camera for this request.",
        ),
      );
    }

    return ringHtml(consentPage("Already closed", "This request is already closed."));
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_camera_consent_stop_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringHtml(consentPage("Link invalid", INVALID_LINK_MESSAGE), 400);
  }
};
