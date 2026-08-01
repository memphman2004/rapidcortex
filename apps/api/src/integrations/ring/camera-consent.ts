import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { randomBytes, randomUUID } from "node:crypto";
import * as bcrypt from "bcryptjs";
import { consentActionForm, consentPage, escapeHtml } from "../../lib/consentPage.js";
import type { RingEmergencyCameraRequest, RingRequestStatus } from "../../lib/ring-integration.js";
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

/** SENT and OPENED both accept consent; OPENED just means the owner loaded the landing page. */
const CONSENTABLE_STATUSES = ["SENT", "OPENED"] as const;

async function findRequestByRequestToken(
  plainToken: string,
  statuses: readonly RingRequestStatus[],
): Promise<RingEmergencyCameraRequest | null> {
  for (const status of statuses) {
    const candidates = await emergencyRepo.listRequestsByStatus(status);
    for (const candidate of candidates) {
      const match = await bcrypt.compare(plainToken, candidate.requestTokenHash);
      if (match) return candidate;
    }
  }
  return null;
}

async function findRequestByConsentToken(
  plainToken: string,
): Promise<RingEmergencyCameraRequest | null> {
  return findRequestByRequestToken(plainToken, CONSENTABLE_STATUSES);
}

function actionForm(
  token: string,
  action: "approve" | "decline" | "stop",
  label: string,
  variant: "allow" | "decline" | "stop",
): string {
  return consentActionForm({
    actionPath: `/api/integrations/ring/consent/${encodeURIComponent(token)}/${action}`,
    label,
    variant,
  });
}

const STOPPABLE_STATUSES = ["SENT", "OPENED", "APPROVED"] as const;

/**
 * Accepts either the dedicated stop token (from the email) or the request token (from the SMS
 * landing page) — the SMS carries a single link, so its token must also be able to stop sharing.
 */
async function findRequestByStopToken(
  plainToken: string,
): Promise<RingEmergencyCameraRequest | null> {
  for (const status of STOPPABLE_STATUSES) {
    const candidates = await emergencyRepo.listRequestsByStatus(status);
    for (const candidate of candidates) {
      const hash = candidate.stopTokenHash;
      if (!hash) continue;
      const match = await bcrypt.compare(plainToken, hash);
      if (match) return candidate;
    }
  }
  return findRequestByRequestToken(plainToken, STOPPABLE_STATUSES);
}

/**
 * Single link sent by SMS. Safe to prefetch: GET only renders state, it never grants or revokes.
 * Approve/decline/stop are POST forms so an SMS app's link preview cannot consent on the owner's
 * behalf.
 */
export const landingHandler: APIGatewayProxyHandlerV2 = async (event) => {
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

    const record = await findRequestByRequestToken(plainToken, STOPPABLE_STATUSES);
    if (!record) {
      return ringHtml(consentPage("Link invalid", INVALID_LINK_MESSAGE), 400);
    }

    const device = escapeHtml(record.deviceName || "camera");

    if (record.requestStatus === "APPROVED") {
      return ringHtml(
        consentPage(
          "Sharing active",
          `You are currently sharing live video from ${device} with emergency responders. You can stop at any time.`,
          `<div class="actions">${actionForm(plainToken, "stop", "Stop sharing now", "stop")}</div>`,
        ),
      );
    }

    if (new Date(record.expiresAt).getTime() <= Date.now() || record.usedAt) {
      return ringHtml(consentPage("Already closed", "This request is no longer active."));
    }

    if (record.requestStatus === "SENT") {
      await emergencyRepo.updateRequest(record.agencyId, record.incidentId, record.requestId, {
        requestStatus: "OPENED",
      });
    }

    const minutes = record.requestedDurationMinutes;
    const actions = `<div class="actions">${actionForm(
      plainToken,
      "approve",
      `Allow for ${minutes} minutes`,
      "allow",
    )}${actionForm(plainToken, "decline", "Decline", "decline")}</div>
      <p class="fine">Sharing stops automatically after ${minutes} minutes, and you can stop it sooner at any time.</p>`;

    return ringHtml(
      consentPage(
        "Emergency video request",
        `Emergency responders are requesting temporary live video from ${device} for an active emergency near your address.`,
        actions,
      ),
    );
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "ring_camera_consent_landing_error",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    return ringHtml(consentPage("Link invalid", INVALID_LINK_MESSAGE), 400);
  }
};

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
