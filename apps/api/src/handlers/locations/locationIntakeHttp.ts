/**
 * Public QR intake submission — NO AUTH.
 * POST /api/r/{rcli}
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isValidRCLI, qrPublicIntakeSchema } from "rapid-cortex-shared";
import { createCampusQrIncident } from "../../campus/campus-incident-service.js";
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
import { PinpointService } from "../../services/pinpointService.js";
import { createVenueQrIncident } from "../../venue/venue-incident-service.js";
import { getVenueGuestMediaFlags } from "../../venue/venue-profile-service.js";

const limiter = new PublicBurstLimiter(10, 3600_000);
const repo = new QRLocationsRepository();
const pinpointService = new PinpointService();

function isVideoMediaKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov");
}

function filterGuestMediaKeys(
  keys: string[],
  flags: { photoUploadsEnabled: boolean; videoUploadsEnabled: boolean },
): string[] {
  return keys.filter((key) =>
    isVideoMediaKey(key) ? flags.videoUploadsEnabled : flags.photoUploadsEnabled,
  );
}

const helpTypeMap: Record<string, string> = {
  medical: "medical",
  safety: "security",
  suspicious: "suspicious_activity",
  other: "other",
};

async function maybeCreateLiveShare(opts: {
  shareLiveLocation: boolean;
  agencyId: string;
  incidentId: string;
  rcli: string;
  callerPhoneE164?: string | null;
}): Promise<{ liveLocationToken: string; liveLocationExpiresHintMin: number } | Record<string, never>> {
  if (!opts.shareLiveLocation) return {};
  try {
    const share = await pinpointService.createInlineQrShare({
      agencyId: opts.agencyId,
      incidentId: opts.incidentId,
      rcli: opts.rcli,
      callerPhoneE164: opts.callerPhoneE164,
    });
    if (!share) return {};
    return {
      liveLocationToken: share.token,
      liveLocationExpiresHintMin: 30,
    };
  } catch (err) {
    console.warn("[location-intake] live share create failed", err);
    return {};
  }
}

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
      const { incident, cameras } = await createCampusQrIncident(
        {
          campusCode,
          buildingCode: location.building ?? "UNKNOWN",
          floor: location.floor ? Number(location.floor) : null,
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
          siteCode: location.siteCode,
          latitude: payload.lat ?? undefined,
          longitude: payload.lng ?? undefined,
        },
        location.agencyId,
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
      const live = await maybeCreateLiveShare({
        shareLiveLocation: Boolean(payload.shareLiveLocation),
        agencyId: location.agencyId,
        incidentId: incident.id,
        rcli,
        callerPhoneE164: payload.reporterPhone,
      });
      await repo.recordScan(rcli);
      return withCorrelationHeaders(
        event,
        ok(
          {
            referenceId,
            incidentId: incident.id,
            rcli,
            locationName: location.locationName,
            zoneCode: location.zoneCode,
            cameras,
            receivedAt: new Date().toISOString(),
            message: "Your report has been received. Help is on the way.",
            ...live,
          },
          201,
        ),
      );
    }

    if (location.vertical === "venue") {
      const mediaFlags = await getVenueGuestMediaFlags(location.orgCode, location.agencyId).catch(
        () => ({ photoUploadsEnabled: true, videoUploadsEnabled: false }),
      );
      const allowedKeys = filterGuestMediaKeys(payload.mediaKeys, mediaFlags);
      const { incident, cameras } = await createVenueQrIncident({
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
          allowedKeys.length > 0
            ? allowedKeys
            : mediaFlags.photoUploadsEnabled && payload.photoDataUrl
              ? ["inline-photo"]
              : [],
      });
      const live = await maybeCreateLiveShare({
        shareLiveLocation: Boolean(payload.shareLiveLocation),
        agencyId: location.agencyId,
        incidentId: incident.incidentId,
        rcli,
        callerPhoneE164: payload.reporterPhone,
      });
      await repo.recordScan(rcli);
      return withCorrelationHeaders(
        event,
        ok(
          {
            referenceId: incident.incidentId,
            incidentId: incident.incidentId,
            rcli,
            locationName: location.locationName,
            zoneCode: location.zoneCode,
            cameras,
            receivedAt: new Date().toISOString(),
            message: "Your report has been received. Help is on the way.",
            ...live,
          },
          201,
        ),
      );
    }

    // transit / hospital / 911 (and other QR verticals): acknowledge + optional live share session
    await repo.recordScan(rcli);
    const referenceId = `${location.orgCode}-${Date.now().toString(36).toUpperCase()}`;
    const live = await maybeCreateLiveShare({
      shareLiveLocation: Boolean(payload.shareLiveLocation),
      agencyId: location.agencyId,
      incidentId: referenceId,
      rcli,
      callerPhoneE164: payload.reporterPhone,
    });
    return withCorrelationHeaders(
      event,
      ok(
        {
          referenceId,
          incidentId: referenceId,
          rcli,
          locationName: location.locationName,
          zoneCode: location.zoneCode,
          receivedAt: new Date().toISOString(),
          message: "Your report has been received. Help is on the way.",
          ...live,
        },
        201,
      ),
    );
  } catch (error) {
    console.error("[location-intake]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
