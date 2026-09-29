/**
 * Venue Export HTTP Handler — RFP 2396IP, Build Item 7
 *
 * GET /api/venue/{agencyId}/export/csv?fromDate=&toDate=   → CSV download
 * GET /api/venue/{agencyId}/export/report/{incidentId}     → PDF report request
 */

import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { getCorrelationId } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { venueCodeFromAgencyId } from "../vertical/agency-id.js";
import { canSupervisorVenueOps, assertAgencyMatch } from "../vertical/agency-route-context.js";
import { exportIncidentsAsCsv, requestPdfReport } from "../../venue/venue-report-service.js";

function actorLabel(user: { email?: string; role: string }): string {
  const email = user.email?.trim();
  if (email) return email.split("@")[0] ?? "Staff";
  return user.role.replace(/^VENUE_/, "").replace(/_/g, " ") || "Staff";
}

export const exportCsv: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd) as APIGatewayProxyResultV2;
    if (!canSupervisorVenueOps(user)) return withCorrelationHeaders(event, forbidden());

    const agencyId = event.pathParameters?.agencyId?.trim();
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
    if (!assertAgencyMatch(user, agencyId)) {
      return withCorrelationHeaders(event, forbidden("Agency mismatch"));
    }

    const venueCode = venueCodeFromAgencyId(agencyId);
    const qs = event.queryStringParameters ?? {};
    const fromDate = qs.fromDate?.trim() || undefined;
    const toDate = qs.toDate?.trim() || undefined;

    const csv = await exportIncidentsAsCsv({ agencyId, venueCode, fromDate, toDate });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="venue-incidents-${venueCode}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
        "X-Request-Id": getCorrelationId(event),
      },
      body: csv,
    };
  } catch (err) {
    console.error("[venue-export-csv]", err);
    return withCorrelationHeaders(event, serverError());
  }
};

export const exportPdfReport: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd) as APIGatewayProxyResultV2;
    if (!canSupervisorVenueOps(user)) return withCorrelationHeaders(event, forbidden());

    const agencyId = event.pathParameters?.agencyId?.trim();
    if (!agencyId) return withCorrelationHeaders(event, badRequest("agencyId required"));
    if (!assertAgencyMatch(user, agencyId)) {
      return withCorrelationHeaders(event, forbidden("Agency mismatch"));
    }

    const incidentId = event.pathParameters?.incidentId?.trim();
    if (!incidentId) return withCorrelationHeaders(event, badRequest("incidentId required"));

    const venueCode = venueCodeFromAgencyId(agencyId);
    const result = await requestPdfReport({
      agencyId,
      venueCode,
      incidentId,
      actorId: user.userId,
      actorLabel: actorLabel(user),
    });
    return withCorrelationHeaders(event, ok(result));
  } catch (err) {
    const e = err as { statusCode?: number };
    if (e.statusCode === 404) return withCorrelationHeaders(event, notFound("Incident not found"));
    if (e.statusCode === 403) return withCorrelationHeaders(event, forbidden());
    console.error("[venue-export-pdf]", err);
    return withCorrelationHeaders(event, serverError());
  }
};
