/**
 * Public engagement tracking — NO AUTH.
 * POST /api/qr-nfc/{qrId}/engage
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { trackEngagementSchema } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";
import {
  badRequest,
  badRequestFromZod,
  jsonStatus,
  notFound,
  ok,
  serverError,
  serviceUnavailable,
} from "../../lib/response.js";
import { QrNfcService } from "../../qr-nfc/qr-nfc-service.js";

const service = new QrNfcService();
const limiter = new PublicBurstLimiter(10, 60_000);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ip = event.requestContext.http.sourceIp ?? "unknown";
    const qrId = event.pathParameters?.qrId?.trim();
    if (!qrId) return withCorrelationHeaders(event, badRequest("qrId required"));

    if (!limiter.allow(`qr-engage:${ip}:${qrId}`)) {
      return withCorrelationHeaders(event, serviceUnavailable("Rate limit exceeded"));
    }

    let medium: "qr" | "nfc" | "direct" | "url" = "direct";
    try {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = trackEngagementSchema.safeParse(body);
      if (parsed.success) medium = parsed.data.medium;
      else if (body && typeof body === "object") {
        const q = event.queryStringParameters?.medium;
        if (q === "qr" || q === "nfc" || q === "direct" || q === "url") medium = q;
      }
    } catch {
      const q = event.queryStringParameters?.medium;
      if (q === "qr" || q === "nfc" || q === "direct" || q === "url") medium = q;
    }

    const qMedium = event.queryStringParameters?.medium;
    if (qMedium === "qr" || qMedium === "nfc" || qMedium === "direct" || qMedium === "url") {
      medium = qMedium;
    }

    const result = await service.engage(qrId, medium);
    return withCorrelationHeaders(event, ok(result));
  } catch (e) {
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return withCorrelationHeaders(event, notFound());
    }
    console.error("[qr-nfc-engage]", e);
    return withCorrelationHeaders(event, serverError());
  }
};
