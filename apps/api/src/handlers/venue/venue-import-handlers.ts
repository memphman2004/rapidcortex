/**
 * Venue Import HTTP Handler — RFP 2396IP, Build Item 6
 *
 * POST /api/venue/{agencyId}/import
 * Body: VenueIntegrationImportBody (source, records[], dryRun?)
 */

import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { venueIntegrationImportBodySchema } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { venueCodeFromAgencyId } from "../vertical/agency-id.js";
import { assertAgencyMatch } from "../vertical/agency-route-context.js";
import { runImport } from "../../venue/venue-import-service.js";

function parseBody(event: { body?: string | null }): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    return null;
  }
}

export const venueImport: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd) as APIGatewayProxyResultV2;

    // Only VENUE_ADMIN may import records
    const role = user.role.trim().toUpperCase();
    const isAdmin = role === "VENUE_ADMIN" || ["RCADMIN", "RCSUPERADMIN"].includes(role);
    if (!isAdmin) return withCorrelationHeaders(event, forbidden());

    const agencyId = event.pathParameters?.agencyId?.trim();
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
    if (!assertAgencyMatch(user, agencyId)) {
      return withCorrelationHeaders(event, forbidden("Agency mismatch"));
    }

    const body = parseBody(event);
    if (body === null) return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    const parsed = venueIntegrationImportBodySchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(
        event,
        badRequest(parsed.error.issues[0]?.message ?? "Invalid import body"),
      );
    }

    const venueCode = venueCodeFromAgencyId(agencyId);
    const result = await runImport({
      agencyId,
      venueCode,
      actorId: user.userId,
      body: parsed.data,
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    console.error("[venue-import]", err);
    return withCorrelationHeaders(event, serverError());
  }
};
