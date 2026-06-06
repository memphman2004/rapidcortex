import type { APIGatewayProxyEventV2 } from "aws-lambda";
import type { AuditEvent } from "rapid-cortex-shared";
import { makeId } from "./ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";

const auditRepo = new AuditRepository();

export type ExternalApiAuditDetail = {
  auditEventId?: string;
  agencyId: string;
  actorType: "api_client" | "rc_lite_api_key";
  /** OAuth client id, or RC Lite `keyId` when actorType is rc_lite_api_key. */
  clientId: string;
  endpoint: string;
  method: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  sourceIp?: string;
  userAgent?: string;
  statusCode: number;
  success: boolean;
  errorCode?: string;
};

export function requestIdentity(event: APIGatewayProxyEventV2): { ip?: string; userAgent?: string } {
  const http = (event.requestContext as { http?: { sourceIp?: string } }).http;
  const ip = http?.sourceIp;
  const fwd = event.headers?.["x-forwarded-for"] ?? event.headers?.["X-Forwarded-For"];
  const firstForwarded = typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined;
  const ua = event.headers?.["user-agent"] ?? event.headers?.["User-Agent"];
  return { ip: firstForwarded || ip, userAgent: ua };
}

export async function writeExternalApiAudit(detail: ExternalApiAuditDetail): Promise<void> {
  const eventId = detail.auditEventId ?? makeId("audit");
  const ev: AuditEvent = {
    eventId,
    agencyId: detail.agencyId,
    actorId: detail.actorType === "rc_lite_api_key" ? `rclk:${detail.clientId}` : `apic:${detail.clientId}`,
    type: "external.api.access",
    details: {
      ...detail,
      eventType: "EXTERNAL_API_ACCESS",
    },
    createdAt: new Date().toISOString(),
    resourceType: "integration",
    resourceId: detail.resourceId ?? detail.clientId,
    ip: detail.sourceIp,
    userAgent: detail.userAgent,
  };
  await auditRepo.create(ev);
}
