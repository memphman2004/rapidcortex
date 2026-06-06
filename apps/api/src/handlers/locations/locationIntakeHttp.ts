/**
 * Public QR intake submission — NO AUTH.
 * POST /api/r/{rcli}
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isValidRCLI, qrPublicIntakeSchema } from "rapid-cortex-shared";
import { createCampusIncident } from "../../campus/campus-incident-service.js";
import { uploadReportPhoto } from "../../campus/campus-media-service.js";
import { createAnonToken } from "../../campus/campus-anon-service.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";
import {
  badRequest,
  badRequestFromZod,
  jsonStatus,
  ok,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";
import { QRLocationsRepository } from "../../repositories/qrLocationsRepository.js";
import { createVenueQrIncident } from "../../venue/venue-incident-service.js";

const limiter = new PublicBurstLimiter(10, 3600_000);
const repo = new QRLocationsRepository();

const helpTypeMap: Record<string, string> = {
  medical: "medical",
  safety: "security",
  suspicious: "suspicious_activity",
  other: "other",
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ip = event.requestContext.http.sourceIp ?? "unknown";
    if (!limiter.allow(`intake:${ip}`)) {
      return withCorrelationHeaders(event, serviceUnavailable("Rate limit exceeded. Please try again later."));
    }

    const rcli = event.pathParameters?.rcli?.trim().toUpperCase() ?? "";
    if (!isValidRCLI(rcli)) {
      return withCorrelationHeaders(
        event,
        jsonStatus(
          { error: "location_not_found", message: "This QR code is no longer active." },
          404,
        ),
      );
    }

    const location = await repo.getByRcli(rcli);
    if (!location || !location.active) {
      return withCorrelationHeaders(
        event,
        jsonStatus(
          { error: "location_not_found", message: "This QR code is no longer active." },
          404,
        ),
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }

    const parsed = qrPublicIntakeSchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    }

    const payload = parsed.data;
    const incidentType = helpTypeMap[payload.helpType] ?? "other";

    if (location.vertical === "campus") {
      const campusCode = location.orgCode;
      const incident = await createCampusIncident(
        {
          campusCode,
          buildingCode: location.building ?? "UNKNOWN",
          roomCode: location.zoneCode,
          zoneCode: location.zoneCode,
          qrRcli: rcli,
          qrLocationName: location.locationName,
          type: incidentType as never,
          source: "qr",
          description:
            payload.description?.trim() ||
            `QR report at ${location.locationName} (zone ${location.zoneCode})`,
          isAnonymous: payload.isAnonymous,
          confidential: false,
          phoneNumber: payload.reporterPhone ?? null,
          photoDataUrl: null,
        },
        campusCode,
        undefined,
      );

      if (payload.photoDataUrl && incident.id) {
        try {
          await uploadReportPhoto(payload.photoDataUrl, campusCode, incident.id);
        } catch {
          // non-fatal
        }
      }

      const referenceId = await createAnonToken(campusCode, incident.id);
      await repo.recordScan(rcli);
      return withCorrelationHeaders(
        event,
        ok(
          {
            referenceId,
            rcli,
            locationName: location.locationName,
            zoneCode: location.zoneCode,
            receivedAt: new Date().toISOString(),
            message: "Your report has been received. Help is on the way.",
          },
          201,
        ),
      );
    }

    if (location.vertical === "venue") {
      const incident = await createVenueQrIncident({
        venueCode: location.orgCode,
        agencyId: location.agencyId,
        rcli,
        locationName: location.locationName,
        zoneCode: location.zoneCode,
        building: location.building,
        floor: location.floor,
        helpType: payload.helpType,
        description:
          payload.description?.trim() ||
          `QR report at ${location.locationName} (zone ${location.zoneCode})`,
        isAnonymous: payload.isAnonymous,
        reporterName: payload.reporterName,
        reporterPhone: payload.reporterPhone,
        lat: payload.lat,
        lng: payload.lng,
        mediaKeys:
          payload.mediaKeys.length > 0
            ? payload.mediaKeys
            : payload.photoDataUrl
              ? ["inline-photo"]
              : [],
      });
      await repo.recordScan(rcli);
      return withCorrelationHeaders(
        event,
        ok(
          {
            referenceId: incident.incidentId,
            rcli,
            locationName: location.locationName,
            zoneCode: location.zoneCode,
            receivedAt: new Date().toISOString(),
            message: "Your report has been received. Help is on the way.",
          },
          201,
        ),
      );
    }

    await repo.recordScan(rcli);
    const referenceId = `${location.orgCode}-${Date.now().toString(36).toUpperCase()}`;
    return withCorrelationHeaders(
      event,
      ok(
        {
          referenceId,
          rcli,
          locationName: location.locationName,
          zoneCode: location.zoneCode,
          receivedAt: new Date().toISOString(),
          message: "Your report has been received. Help is on the way.",
        },
        201,
      ),
    );
  } catch (error) {
    console.error("[location-intake]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
