/**
 * Public presigned upload URL for QR/NFC campus–venue report media — NO AUTH.
 * GET /api/public/report/media-upload-url?qrId=&type=image|video
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { PublicBurstLimiter } from "../../lib/publicRateLimiter.js";
import { badRequest, forbidden, jsonStatus, ok, serverError, serviceUnavailable } from "../../lib/response.js";
import { QrNfcRepository } from "../../repositories/qrNfcRepository.js";
import { getVenueGuestMediaFlags } from "../../venue/venue-profile-service.js";

const limiter = new PublicBurstLimiter(5, 600_000);
const repo = new QrNfcRepository();
const s3 = new S3Client({ region: env.region });

function assetsBucket(): string {
  const bucket = process.env.ASSETS_BUCKET?.trim();
  if (!bucket) throw new Error("ASSETS_BUCKET not configured");
  return bucket;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const ip = event.requestContext.http.sourceIp ?? "unknown";
    if (!limiter.allow(`public-report-media:${ip}`)) {
      return withCorrelationHeaders(event, serviceUnavailable("Rate limit exceeded. Please try again later."));
    }

    const qrId = event.queryStringParameters?.qrId?.trim() ?? "";
    if (!qrId || qrId.length > 64) {
      return withCorrelationHeaders(event, badRequest("qrId is required"));
    }

    const record = await repo.getByQrId(qrId);
    if (!record || !record.active) {
      return withCorrelationHeaders(
        event,
        jsonStatus({ error: "location_not_found", message: "This QR code is no longer active." }, 404),
      );
    }

    const mediaType = (event.queryStringParameters?.type ?? "image").toLowerCase();
    const isVideo = mediaType === "video";

    if (record.vertical === "venue") {
      const m = record.agencyId.trim().match(/(?:test-)?venue-(.+)$/i);
      const venueCode = (m?.[1] ?? record.agencyId).toUpperCase();
      const flags = await getVenueGuestMediaFlags(venueCode, record.agencyId).catch(() => ({
        photoUploadsEnabled: true,
        videoUploadsEnabled: false,
      }));
      if (isVideo && !flags.videoUploadsEnabled) {
        return withCorrelationHeaders(event, forbidden("Video uploads are disabled for this venue."));
      }
      if (!isVideo && !flags.photoUploadsEnabled) {
        return withCorrelationHeaders(event, forbidden("Photo uploads are disabled for this venue."));
      }
    }

    const ext = isVideo ? "mp4" : "jpg";
    const contentType = isVideo ? "video/mp4" : "image/jpeg";
    const key = `qr-intake/${record.agencyId}/${qrId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: assetsBucket(),
        Key: key,
        ContentType: contentType,
        Metadata: {
          source: "public_report",
          qrId,
          agencyId: record.agencyId,
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
    console.error("[public-report-media-upload]", error);
    return withCorrelationHeaders(event, serverError());
  }
};
