/**
 * Public report submission — NO AUTH.
 * POST /api/public/report
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PINPOINT_CONFIG, publicReportSubmitSchema, toE164 } from "rapid-cortex-shared";
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
import { PinpointService } from "../../services/pinpointService.js";

const repo = new QrNfcRepository();
const auditRepo = new AuditRepository();
const pinpoint = new PinpointService();
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
    const phoneE164 = toE164(input.reporterPhone) ?? undefined;
    if (phoneE164) input.reporterPhone = phoneE164;

    // Only accept keys minted for this QR by the public media-upload endpoint.
    const keyPrefix = `qr-intake/${record.agencyId}/${record.qrId}/`;
    if (input.mediaKeys?.length) {
      input.mediaKeys = input.mediaKeys.filter((k) => k.startsWith(keyPrefix) && !k.includes(".."));
    }

    if (record.reportType === "anonymous") {
      input.reporterName = undefined;
      // Campus: keep callback phone for ops + optional live location even when anonymous.
      if (record.vertical !== "campus") {
        input.reporterPhone = undefined;
      }
    }

    if (input.shareLiveLocation && record.vertical === "campus" && !input.reporterPhone) {
      return withCorrelationHeaders(
        event,
        badRequest("A callback phone number is required to share live location."),
      );
    }

    const incidentId = await createIncidentFromQrNfcReport(record, input);
    const now = new Date().toISOString();

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: record.agencyId,
      incidentId,
      actorId: "public-report",
      type: AUDIT_EVENT_TYPES.PUBLIC_REPORT_SUBMITTED,
      details: {
        qrId: record.qrId,
        medium: input.medium,
        vertical: record.vertical,
        shareLiveLocation: Boolean(input.shareLiveLocation),
      },
      createdAt: now,
      resourceType: "incident",
      resourceId: incidentId,
    });

    let liveLocationToken: string | undefined;
    let liveLocationExpiresHintMin: number | undefined;
    if (input.shareLiveLocation && record.vertical === "campus") {
      try {
        const share = await pinpoint.createInlineQrShare({
          agencyId: record.agencyId,
          incidentId,
          rcli: record.qrId,
          callerPhoneE164: input.reporterPhone,
          consentGrantedAt: now,
        });
        if (share) {
          liveLocationToken = share.token;
          liveLocationExpiresHintMin = PINPOINT_CONFIG.LINK_EXPIRY_MINUTES;
        }
      } catch (err) {
        console.warn("[public-report] live share create failed", err);
      }
    }

    return withCorrelationHeaders(
      event,
      jsonStatus(
        {
          incidentId,
          referenceCode:
            incidentId.replace(/^inc_/, "").slice(0, 8).toUpperCase() ||
            incidentId.slice(0, 8).toUpperCase(),
          ...(liveLocationToken
            ? {
                trackingToken: liveLocationToken,
                liveLocationToken,
                liveLocationExpiresHintMin,
              }
            : {}),
        },
        201,
      ),
    );
  } catch (e) {
    console.error("[public-report]", e);
    return withCorrelationHeaders(event, serverError());
  }
};
