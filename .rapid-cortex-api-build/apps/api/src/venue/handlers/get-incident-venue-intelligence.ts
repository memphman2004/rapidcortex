import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { venueIntelligenceQuerySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { resolveIncidentRead } from "../../lib/incidentReadAccess.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { VenueIntelligenceService } from "../venue-intelligence-service.js";

const authz = new AuthorizationService();
const venueIntel = new VenueIntelligenceService();
const auditRepo = new AuditRepository();

const CATEGORY_TO_PLAN_TYPE: Record<string, string> = {
  fire: "FIRE",
  medical: "MEDICAL",
  police: "ACTIVE_THREAT",
  welfare_check: "MEDICAL",
  domestic_disturbance: "ACTIVE_THREAT",
  unknown: "GENERAL",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const incidentId = event.pathParameters?.id?.trim();
    if (!incidentId) return withCorrelationHeaders(event, badRequest("Incident ID is required"));

    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    authz.assertCanPerform(user, "incidents.view");

    const resolution = await resolveIncidentRead(incidentId, user);
    if (!resolution) {
      return withCorrelationHeaders(event, forbidden("Incident not found or access denied"));
    }
    const { incident } = resolution;

    const address = incident.callerAddressLine?.trim();
    if (!address) {
      return withCorrelationHeaders(event, ok({ intelligence: null, reason: "no_caller_address" }));
    }

    const floorParam = event.queryStringParameters?.floor;
    const queryParsed = venueIntelligenceQuerySchema.safeParse({
      address,
      incidentId,
      incidentType: CATEGORY_TO_PLAN_TYPE[incident.category] ?? "GENERAL",
      ...(floorParam !== undefined ? { floor: floorParam } : {}),
    });
    if (!queryParsed.success) {
      return withCorrelationHeaders(event, badRequest("Invalid query parameters"));
    }

    const intelligence = await venueIntel.getIntelligence({
      address: queryParsed.data.address,
      agencyId: user.agencyId,
      incidentId: queryParsed.data.incidentId,
      incidentType: queryParsed.data.incidentType,
      floor: queryParsed.data.floor,
    });

    if (intelligence) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VENUE_INTELLIGENCE_VIEWED,
        details: {
          facilityId: intelligence.facility.facilityId,
          facilityName: intelligence.facility.name,
          cameraCount: intelligence.cameras.length,
        },
        createdAt: new Date().toISOString(),
        resourceType: "venue_facility",
        resourceId: intelligence.facility.facilityId,
      });
    }

    return withCorrelationHeaders(event, ok({ intelligence }));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[venue-intelligence]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
