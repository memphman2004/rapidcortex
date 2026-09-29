/**
 * Venue Analytics HTTP Handler — RFP 2396IP, Build Item 5
 *
 * GET /api/venue/{agencyId}/analytics/trends?fromDate=&toDate=
 */

import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
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
import { canSupervisorVenueOps, assertAgencyMatch } from "../vertical/agency-route-context.js";
import { getVenueAnalyticsTrends } from "../../venue/venue-analytics-service.js";

export const analyticsTrends: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd) as APIGatewayProxyResultV2;
    if (!canSupervisorVenueOps(user)) {
      return withCorrelationHeaders(event, forbidden());
    }

    const agencyId = event.pathParameters?.agencyId?.trim();
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
    if (!assertAgencyMatch(user, agencyId)) {
      return withCorrelationHeaders(event, forbidden("Agency mismatch"));
    }

    const venueCode = venueCodeFromAgencyId(agencyId);
    const qs = event.queryStringParameters ?? {};
    const fromDate = qs.fromDate?.trim() || undefined;
    const toDate = qs.toDate?.trim() || undefined;

    // Validate date format if provided
    if (fromDate && !/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return withCorrelationHeaders(event, badRequest("fromDate must be YYYY-MM-DD"));
    }
    if (toDate && !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return withCorrelationHeaders(event, badRequest("toDate must be YYYY-MM-DD"));
    }

    const trends = await getVenueAnalyticsTrends({
      agencyId,
      venueCode,
      fromDate,
      toDate,
    });
    return withCorrelationHeaders(event, ok(trends));
  } catch (err) {
    console.error("[venue-analytics-trends]", err);
    return withCorrelationHeaders(event, serverError());
  }
};
