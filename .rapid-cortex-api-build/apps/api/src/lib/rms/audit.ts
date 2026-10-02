import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { AuditEventTypeName } from "rapid-cortex-security";
import type { UserContext } from "rapid-cortex-shared";
import { makeId } from "../ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

export async function auditRmsMutation(opts: {
  type: AuditEventTypeName;
  user: UserContext;
  agencyId: string;
  incidentId?: string;
  reportId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      incidentId: opts.incidentId,
      actorId: opts.user.userId,
      type: opts.type,
      details: {
        reportId: opts.reportId,
        ...(opts.metadata ?? {}),
      },
      createdAt: new Date().toISOString(),
      resourceType: "incident_report",
      resourceId: opts.reportId,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        msg: "rms_audit_write_failed",
        type: opts.type,
        reportId: opts.reportId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export { AUDIT_EVENT_TYPES };
