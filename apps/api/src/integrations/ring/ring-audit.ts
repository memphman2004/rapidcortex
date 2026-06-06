import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

export async function auditRingEvent(params: {
  type: (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];
  agencyId: string;
  actorId: string;
  details: Record<string, unknown>;
  resourceId?: string;
}): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: params.agencyId,
    actorId: params.actorId,
    type: params.type,
    details: params.details,
    createdAt: new Date().toISOString(),
    resourceType: "unknown",
    resourceId: params.resourceId ?? params.actorId,
  });
}

export { AUDIT_EVENT_TYPES };
