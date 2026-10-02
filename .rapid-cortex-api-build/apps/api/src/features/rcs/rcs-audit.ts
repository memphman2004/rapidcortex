import type { AuditEventType, UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { makeId } from "../../lib/ids.js";

const auditRepo = new AuditRepository();

export async function writeRcsAudit(
  actor: UserContext,
  type: (typeof AUDIT_EVENT_TYPES)[
    | "RCS_CALL_STARTED"
    | "RCS_CALL_STATE_CHANGED"
    | "RCS_CALL_ESCALATED"
    | "RCS_CALL_AUDIO_ALERT"
    | "RCS_CALL_SUPERVISOR_ACKNOWLEDGED"
    | "RCS_CALL_CLOSED"
    | "RCS_CALL_OVERRIDE_CLOSED"],
  callId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: type as AuditEventType,
    details,
    createdAt: new Date().toISOString(),
    resourceType: "rcs_call",
    resourceId: callId,
  });
}
