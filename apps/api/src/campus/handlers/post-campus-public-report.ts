/**
 * Public anonymous campus safety report endpoint.
 * NO AUTH — called from QR code scan or SMS fallback.
 * Rate limited: 5 requests per IP per hour.
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";
import { createAnonToken } from "../campus-anon-service.js";
import { getCampusConfig } from "../campus-config-service.js";
import { createCampusIncident } from "../campus-incident-service.js";
import { uploadReportPhoto } from "../campus-media-service.js";
import { isConfidentialType, publicReportSchema } from "../campus-schemas.js";

const ipHitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 5;
const WINDOW_MS = 3600_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHitMap.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipHitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ip =
      event.requestContext.http.sourceIp ?? event.headers["x-forwarded-for"]?.split(",")[0] ?? "unknown";

    if (isRateLimited(ip)) {
      return withCorrelationHeaders(
        event,
        serviceUnavailable("Rate limit exceeded. Please try again later."),
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return withCorrelationHeaders(event, badRequest("Invalid JSON"));
    }

    const parsed = publicReportSchema.safeParse(body);
    if (!parsed.success) {
      return withCorrelationHeaders(event, badRequestFromZod(parsed.error));
    }

    const { campusCode, helpType, description, photoDataUrl, buildingCode, roomCode, phoneNumber } = parsed.data;
    const config = await getCampusConfig(campusCode).catch(() => null);
    if (!config || !config.active) {
      return withCorrelationHeaders(event, notFound("Campus not found"));
    }

    const typeMap: Record<string, string> = {
      medical: "medical",
      security: "security",
      mental_health: "mental_health",
      suspicious: "suspicious_activity",
      wellness_check: "wellness_check",
      property: "property_crime",
      maintenance: "maintenance",
      other: "other",
    };
    const incidentType = typeMap[helpType] ?? "other";

    const incident = await createCampusIncident(
      {
        campusCode,
        buildingCode: buildingCode || "UNKNOWN",
        roomCode: roomCode || "",
        type: incidentType as never,
        source: "qr",
        description: description || "(No description provided)",
        isAnonymous: true,
        confidential: isConfidentialType(incidentType),
        phoneNumber: phoneNumber ?? null,
        photoDataUrl: null,
      },
      campusCode,
      undefined,
    );

    if (photoDataUrl && incident.id) {
      try {
        await uploadReportPhoto(photoDataUrl, campusCode, incident.id);
      } catch {
        // non-fatal
      }
    }

    const referenceId = await createAnonToken(campusCode, incident.id);
    return withCorrelationHeaders(
      event,
      ok(
        {
          referenceId,
          campusCode,
          receivedAt: new Date().toISOString(),
          message: "Your report has been received by campus safety personnel.",
        },
        201,
      ),
    );
  } catch (error) {
    console.error("[campus-public-report]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
