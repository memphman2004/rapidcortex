/**
 * CAD / platform audit helpers (F7).
 * emitAuditEvent is fire-and-forget — never await on request paths.
 */
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import type { AuditEvent, AuditEventType, AuditResourceType } from "rapid-cortex-shared";
import { makeId } from "./ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

type IpSource = {
  requestContext?: {
    http?: { sourceIp?: string };
    identity?: { sourceIp?: string };
  };
  headers?: Record<string, string | undefined>;
};

/** Extract client IP from API Gateway v2 event (or compatible shape). */
export function extractIp(event: IpSource): string {
  const headers = event.headers ?? {};
  const forwarded =
    headers["x-forwarded-for"] ??
    headers["X-Forwarded-For"] ??
    headers["X-Forwarded-for"];
  return (
    event.requestContext?.http?.sourceIp?.trim() ||
    event.requestContext?.identity?.sourceIp?.trim() ||
    forwarded?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export type EmitAuditEventInput = {
  eventType: string;
  agencyId: string;
  actorUserId: string;
  actorRole: string;
  ipAddress: string;
  incidentId?: string;
  cadIncidentId?: string | null;
  resourceType?: AuditResourceType | string;
  resourceId?: string;
  payload?: Record<string, unknown>;
};

/**
 * Fire-and-forget platform audit write.
 * Maps F7 field names onto the canonical AuditEvent shape (actorId / type / details / ip).
 */
export function emitAuditEvent(input: EmitAuditEventInput): void {
  const createdAt = new Date().toISOString();
  const ip = input.ipAddress?.trim() || "unknown";
  const event: AuditEvent = {
    eventId: makeId("aud"),
    agencyId: input.agencyId,
    actorId: input.actorUserId,
    actorRole: input.actorRole,
    type: input.eventType as AuditEventType,
    incidentId: input.incidentId,
    cadIncidentId: input.cadIncidentId ?? undefined,
    details: input.payload ?? {},
    createdAt,
    resourceType: input.resourceType as AuditResourceType | undefined,
    resourceId: input.resourceId,
    ip,
    ipAddress: ip,
  };
  void auditRepo.create(event).catch((err: unknown) => {
    console.error(
      JSON.stringify({
        type: "audit.emit_failed",
        eventType: input.eventType,
        agencyId: input.agencyId,
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
  });
}

/** F9 helper — emit before forbidden()/unauthorized() on CAD routes (not addon gates). */
export function emitCadUnauthorizedAccess(opts: {
  event: APIGatewayProxyEventV2 | IpSource;
  agencyId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  reason?: string;
}): void {
  const rawPath =
    (opts.event as APIGatewayProxyEventV2).rawPath ??
    (opts.event as { path?: string }).path ??
    "unknown";
  emitAuditEvent({
    eventType: AUDIT_EVENT_TYPES.CAD_UNAUTHORIZED_ACCESS,
    agencyId: opts.agencyId?.trim() || "unknown",
    actorUserId: opts.actorUserId?.trim() || "unknown",
    actorRole: opts.actorRole?.trim() || "unknown",
    ipAddress: extractIp(opts.event),
    resourceType: "cad_writeback",
    resourceId: rawPath,
    payload: {
      reason: opts.reason ?? "insufficient_permissions",
      path: rawPath,
    },
  });
}
