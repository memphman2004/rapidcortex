/**
 * Signed inbound campus security-event webhook (SOC-001 / SOC-022 / SOC-028 / SOC-040).
 * NO JWT — HMAC or shared token. Vendor-agnostic queue before native VMS/ALPR connectors.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import {
  campusSecurityEventBodySchema,
  mapSecurityEventTypeToIncidentType,
} from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { makeId } from "../../lib/ids.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
} from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { resolveCampusAgencyId } from "../campus-access.js";
import { getCampusConfig } from "../campus-config-service.js";
import { createCampusQrIncident } from "../campus-incident-service.js";
import { verifyCampusSecurityEventAuth } from "../campus-security-event-auth.js";

const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableCampusSecurityEvents) {
      return withCorrelationHeaders(event, serviceUnavailable("Campus security events are disabled"));
    }

    const rawBody = event.body ?? "{}";
    const auth = verifyCampusSecurityEventAuth(event, rawBody);
    if (!auth.ok) {
      if (auth.reason === "webhook_secret_not_configured") {
        return withCorrelationHeaders(event, serviceUnavailable("Security event webhook secret is not configured"));
      }
      return withCorrelationHeaders(event, unauthorized("Invalid security event signature"));
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }

    const pathCode = event.pathParameters?.campusCode?.trim();
    const parsed = campusSecurityEventBodySchema.safeParse({
      ...(typeof json === "object" && json ? json : {}),
      campusCode: pathCode || (json as { campusCode?: string })?.campusCode,
    });
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    }

    const body = parsed.data;
    const config = await getCampusConfig(body.campusCode).catch(() => null);
    if (!config || !config.active) {
      return withCorrelationHeaders(event, notFound("Campus not found"));
    }

    const agencyId = await resolveCampusAgencyId(body.campusCode);
    if (!agencyId) {
      return withCorrelationHeaders(event, notFound("Campus agency not found"));
    }

    const incidentType = mapSecurityEventTypeToIncidentType(body.type);
    const description =
      body.description?.trim() ||
      `${body.source.toUpperCase()} event (${body.type}) severity=${body.severity}`;

    const { incident, cameras } = await createCampusQrIncident(
      {
        campusCode: body.campusCode,
        buildingCode: body.location?.buildingCode?.trim() || "UNKNOWN",
        floor: body.location?.floor,
        roomCode: body.location?.zoneCode ?? "",
        zoneCode: body.location?.zoneCode,
        qrRcli: body.location?.qrRcli,
        siteCode: body.location?.siteCode,
        type: incidentType,
        source: body.source,
        description,
        isAnonymous: true,
        confidential: false,
      },
      agencyId,
      `security-event:${body.source}`,
    );

    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      incidentId: incident.id,
      actorId: `security-event:${body.source}`,
      type: AUDIT_EVENT_TYPES.CAMPUS_SECURITY_EVENT_INGESTED,
      details: {
        campusCode: body.campusCode,
        source: body.source,
        eventType: body.type,
        severity: body.severity,
      },
      createdAt: now,
      resourceType: "incident",
      resourceId: incident.id,
    });

    return withCorrelationHeaders(
      event,
      ok(
        {
          incidentId: incident.id,
          campusCode: body.campusCode,
          cameras: cameras.map((c) => c.cameraId),
          receivedAt: now,
        },
        201,
      ),
    );
  } catch (error) {
    console.error("[campus-security-event]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
