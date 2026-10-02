/**
 * Public RCLI resolver — NO AUTH.
 * GET /api/r/{rcli}
 */
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isValidRCLI } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";
import { jsonStatus, ok, serviceUnavailable } from "../../lib/response.js";
import { resolvePublicLocation } from "../../locations/qr-location-service.js";

const limiter = new PublicBurstLimiter(60, 60_000);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const ip = event.requestContext.http.sourceIp ?? "unknown";
  if (!limiter.allow(`resolve:${ip}`)) {
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

  const location = await resolvePublicLocation(rcli).catch(() => null);
  if (!location) {
    return withCorrelationHeaders(
      event,
      jsonStatus(
        { error: "location_not_found", message: "This QR code is no longer active." },
        404,
      ),
    );
  }

  return withCorrelationHeaders(event, ok(location));
};
