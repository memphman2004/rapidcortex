import { AUDIT_EVENT_TYPES, type AuditEventTypeName } from "./audit-schema.js";

// TODO(prod) — Section 5.1: map Product checklist events (`auth.logout`, `user.invited`, `media.deleted`, `export.requested`, …)
// onto `AUDIT_EVENT_TYPES` + Lambda writers until every CJIS-required action emits an immutable tenant-scoped audit row.

export type SecurityAuditEvent = {
  action: AuditEventTypeName | string;
  agencyId: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  /** Redacted payload — never raw transcript by default in CJIS-aligned paths. */
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

/** Append-only audit sink — wire to Dynamo, CloudWatch, or SIEM in `apps/api`. */
export class AuditLogger {
  constructor(private readonly sink: (event: SecurityAuditEvent) => Promise<void>) {}

  async log(event: SecurityAuditEvent): Promise<void> {
    await this.sink(event);
  }

  async logIncidentAccess(params: {
    agencyId: string;
    actorId: string;
    incidentId: string;
    ip?: string;
  }): Promise<void> {
    await this.log({
      action: AUDIT_EVENT_TYPES.INCIDENT_ACCESSED,
      agencyId: params.agencyId,
      actorId: params.actorId,
      resourceType: "incident",
      resourceId: params.incidentId,
      details: {},
      ip: params.ip,
    });
  }
}
