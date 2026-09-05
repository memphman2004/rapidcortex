import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { AuthorizationService } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { forbidden, notFound, ok, serverError, unauthorized } from "../../lib/response.js";
import { getCampusIncident } from "../campus-incident-service.js";
import { exportCampusAfterActionPdf } from "../campus-after-action-pdf.js";
import { isCampusCounselorQueueType } from "rapid-cortex-shared";

const authz = new AuthorizationService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return withCorrelationHeaders(event, unauthorized());
    if (!isUserAccountActive(user)) {
      return withCorrelationHeaders(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));
    }
    const pwd = operationalPasswordBlock(user);
    if (pwd) return withCorrelationHeaders(event, pwd);
    const canViewIncidents = authz.canPerform(user, "campus.incidents.view" as never);
    const canViewWellness = authz.canPerform(user, "campus.wellness.view" as never);
    if (!canViewIncidents && !canViewWellness) {
      return withCorrelationHeaders(event, forbidden());
    }

    const incidentId = event.pathParameters?.incidentId;
    const campusCode = event.queryStringParameters?.campusCode;
    if (!campusCode || !incidentId) {
      return withCorrelationHeaders(event, notFound("Missing campusCode query or incidentId path"));
    }

    const incident = await getCampusIncident(campusCode, incidentId);
    if (!incident) return withCorrelationHeaders(event, notFound("Incident not found"));

    const counselorOnly = !canViewIncidents && canViewWellness;
    if (counselorOnly) {
      const allowed =
        isCampusCounselorQueueType(incident.type) || incident.assignedTo === "campus_counselor";
      if (!allowed) return withCorrelationHeaders(event, forbidden());
    }

    if (incident.confidential && !canViewWellness && canViewIncidents) {
      return withCorrelationHeaders(
        event,
        ok({
          incident: {
            id: incident.id,
            status: incident.status,
            buildingLabel: incident.buildingLabel,
            createdAt: incident.createdAt,
            confidential: true,
            _restricted: true,
          },
        }),
      );
    }

    if (event.queryStringParameters?.format === "pdf") {
      const pdf = await exportCampusAfterActionPdf(incident);
      return withCorrelationHeaders(event, {
        statusCode: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="campus-aar-${incident.id}.pdf"`,
        },
        body: pdf.toString("base64"),
        isBase64Encoded: true,
      });
    }

    return withCorrelationHeaders(event, ok({ incident }));
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_PERMISSION") {
      return withCorrelationHeaders(event, forbidden());
    }
    console.error("[campus-incident-get]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
