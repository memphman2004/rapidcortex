import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import { ok, notFound, badRequest } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { visionStore } from "../../rapid-vision/store.js";

const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!env.enableRapidVision) return ok({ error: "Rapid Vision™ is disabled" }, 503);

  const path = event.rawPath ?? event.requestContext.http.path ?? "";
  const match = path.match(/\/api\/public\/vision\/consent\/([^/]+)\/(approve|decline)$/);
  if (!match) return notFound();

  const token = decodeURIComponent(match[1] ?? "").trim();
  const action = match[2];
  if (!token) return badRequest("token required");

  const record = await visionStore.getConsentByToken(token);
  if (!record) return notFound("Consent request not found");
  if (new Date(record.expiresAt) <= new Date()) {
    return ok({ success: false, error: "Consent request expired" }, 410);
  }

  if (action === "approve") {
    await visionStore.activateSession(record.incidentId, record.sessionId, record.agencyId);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: record.agencyId,
      incidentId: record.incidentId,
      actorId: "owner",
      type: AUDIT_EVENT_TYPES.VISION_CONSENT_GRANTED,
      details: { sessionId: record.sessionId },
      createdAt: new Date().toISOString(),
      resourceType: "incident",
      resourceId: record.sessionId,
    });
    return ok({ success: true, message: "Access approved. Rapid Vision™ analysis will start." });
  }

  await visionStore.declineSession(record.incidentId, record.sessionId, record.agencyId);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: record.agencyId,
    incidentId: record.incidentId,
    actorId: "owner",
    type: AUDIT_EVENT_TYPES.VISION_CONSENT_DECLINED,
    details: { sessionId: record.sessionId },
    createdAt: new Date().toISOString(),
    resourceType: "incident",
    resourceId: record.sessionId,
  });
  return ok({ success: true, message: "Access declined." });
};
