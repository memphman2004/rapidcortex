import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService, AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { venueIntelligenceQuerySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { badRequest, forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { VenueIntelligenceService } from "../venue-intelligence-service.js";

const authz = new AuthorizationService();
const venueIntel = new VenueIntelligenceService();
const auditRepo = new AuditRepository();

/** Query-based venue intelligence lookup (address in query string). */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);

    authz.assertCanPerform(user, "incidents.view");

    const parsed = venueIntelligenceQuerySchema.safeParse({
      address: event.queryStringParameters?.address,
      incidentId: event.queryStringParameters?.incidentId,
      incidentType: event.queryStringParameters?.incidentType,
      floor: event.queryStringParameters?.floor,
    });
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequest("address is required"));
    }

    const intelligence = await venueIntel.getIntelligence({
      address: parsed.data.address,
      agencyId: user.agencyId,
      incidentId: parsed.data.incidentId,
      incidentType: parsed.data.incidentType,
      floor: parsed.data.floor,
    });

    if (intelligence) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: user.agencyId,
        incidentId: parsed.data.incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VENUE_INTELLIGENCE_VIEWED,
        details: {
          facilityId: intelligence.facility.facilityId,
          facilityName: intelligence.facility.name,
          lookup: "query",
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
    console.error("[venue-intelligence-query]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
