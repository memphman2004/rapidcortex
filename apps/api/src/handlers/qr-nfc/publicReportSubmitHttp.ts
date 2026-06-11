/**
 * Public report submission — NO AUTH.
 * POST /api/public/report
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { publicReportSubmitSchema } from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { makeId } from "../../lib/ids.js";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";
import {
  badRequest,
  badRequestFromZod,
  jsonStatus,
  notFound,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";
import { createIncidentFromQrNfcReport } from "../../qr-nfc/qr-nfc-incident-service.js";
import { QrNfcRepository } from "../../repositories/qrNfcRepository.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

const repo = new QrNfcRepository();
const auditRepo = new AuditRepository();
const limiter = new PublicBurstLimiter(5, 600_000);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ip = event.requestContext.http.sourceIp ?? "unknown";
    if (!limiter.allow(`public-report:${ip}`)) {
      return withCorrelationHeaders(event, serviceUnavailable("Rate limit exceeded"));
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }

    const parsed = publicReportSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    }

    const record = await repo.getByQrId(parsed.data.qrId);
    if (!record || !record.active) {
      return withCorrelationHeaders(event, notFound());
    }

    const input = { ...parsed.data };
    if (record.reportType === "anonymous") {
      input.reporterName = undefined;
      input.reporterPhone = undefined;
    }

    const incidentId = await createIncidentFromQrNfcReport(record, input);
    const now = new Date().toISOString();

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: record.agencyId,
      incidentId,
      actorId: "public-report",
      type: AUDIT_EVENT_TYPES.PUBLIC_REPORT_SUBMITTED,
      details: { qrId: record.qrId, medium: input.medium, vertical: record.vertical },
      createdAt: now,
      resourceType: "incident",
      resourceId: incidentId,
    });

    return withCorrelationHeaders(
      event,
      jsonStatus(
        {
          incidentId,
          referenceCode: incidentId.replace(/^inc_/, "").slice(0, 8).toUpperCase() || incidentId.slice(0, 8).toUpperCase(),
        },
        201,
      ),
    );
  } catch (e) {
    console.error("[public-report]", e);
    return withCorrelationHeaders(event, serverError());
  }
};
