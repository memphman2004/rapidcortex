import type { AuditEventType, UserContext } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AuditRepository } from "../repositories/auditRepository.js";
import { makeId } from "./ids.js";

const auditRepo = new AuditRepository();

export async function writeUserManagementAudit(
  actor: UserContext,
  type:
    | typeof AUDIT_EVENT_TYPES.ADMIN_USER_CREATE
    | typeof AUDIT_EVENT_TYPES.ADMIN_USER_UPDATE
    | typeof AUDIT_EVENT_TYPES.ADMIN_USER_DEACTIVATE
    | typeof AUDIT_EVENT_TYPES.PASSWORD_CHANGE_REQUIRED_SET,
  details: Record<string, unknown>,
  resourceId?: string,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: actor.agencyId,
    actorId: actor.userId,
    type: type as AuditEventType,
    details,
    createdAt: new Date().toISOString(),
    resourceType: "user",
    resourceId,
  });
}
