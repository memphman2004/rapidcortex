/**
 * Public presigned upload URL for QR intake media — NO AUTH.
 * GET /api/r/{rcli}/media-upload-url?type=image|video
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { isValidRCLI } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";
import { jsonStatus, ok, serverError, serviceUnavailable } from "../../lib/response.js";
import { QRLocationsRepository } from "../../repositories/qrLocationsRepository.js";

const limiter = new PublicBurstLimiter(5, 600_000);
const repo = new QRLocationsRepository();
const s3 = new S3Client({ region: env.region });

function assetsBucket(): string {
  const bucket = process.env.ASSETS_BUCKET?.trim();
  if (!bucket) throw new Error("ASSETS_BUCKET not configured");
  return bucket;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ip = event.requestContext.http.sourceIp ?? "unknown";
    if (!limiter.allow(`media:${ip}`)) {
      return withCorrelationHeaders(event, serviceUnavailable("Rate limit exceeded. Please try again later."));
    }

    const rcli = event.pathParameters?.rcli?.trim().toUpperCase() ?? "";
    if (!isValidRCLI(rcli)) {
      return withCorrelationHeaders(
        event,
        jsonStatus({ error: "location_not_found", message: "This QR code is no longer active." }, 404),
      );
    }

    const location = await repo.getByRcli(rcli);
    if (!location || !location.active) {
      return withCorrelationHeaders(
        event,
        jsonStatus({ error: "location_not_found", message: "This QR code is no longer active." }, 404),
      );
    }

    const mediaType = (event.queryStringParameters?.type ?? "image").toLowerCase();
    const ext = mediaType === "video" ? "mp4" : "jpg";
    const contentType = mediaType === "video" ? "video/mp4" : "image/jpeg";
    const key = `qr-intake/${location.agencyId}/${rcli}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: assetsBucket(),
        Key: key,
        ContentType: contentType,
        Metadata: {
          source: "qr_intake",
          rcli,
          agencyId: location.agencyId,
        },
      }),
      { expiresIn: 900 },
    );

    return withCorrelationHeaders(
      event,
      ok({
        uploadUrl,
        key,
        expiresIn: 900,
        contentType,
      }),
    );
  } catch (error) {
    console.error("[location-media-upload]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
