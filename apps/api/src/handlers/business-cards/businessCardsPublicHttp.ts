import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { consumeRateLimit, NEXCORT_COMPANY_NAME } from "../../lib/business-cards/domain.js";
import { DynamoBizCardRepo } from "../../lib/business-cards/dynamo-repo.js";
import { EventSchema } from "../../lib/business-cards/schemas.js";
import { BusinessCardService } from "../../lib/business-cards/service.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { jsonStatus, ok } from "../../lib/response.js";
import { mapBizCardError, readJson, zodFailure } from "./present.js";

const s3 = new S3Client({
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

function buildService(): BusinessCardService {
  const table = process.env.BIZCARD_TABLE_NAME?.trim();
  if (!table) throw new Error("BIZCARD_TABLE_NAME is not set");
  const domain = process.env.BIZCARD_CLOUDFRONT_DOMAIN?.trim();
  const bucket = process.env.BIZCARD_PHOTO_BUCKET?.trim();
  return new BusinessCardService(new DynamoBizCardRepo(table), {
    globalEnabled: process.env.ENABLE_BUSINESS_CARDS === "true" || process.env.ENABLE_BUSINESS_CARDS === "1",
    publicBaseUrl: process.env.BIZCARD_PUBLIC_BASE_URL?.trim() || "https://www.nexcortiq.us",
    photoBaseUrl: domain ? `https://${domain}` : undefined,
    signPhoto: bucket
      ? async (key) => {
          if (!key.startsWith("biz-cards/")) return undefined;
          return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
        }
      : undefined,
    resolveCompany: async () => ({ name: NEXCORT_COMPANY_NAME, website: "https://www.nexcortiq.us" }),
    loadPhoto: async (key) => {
      if (!bucket || !key.startsWith("biz-cards/")) return null;
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await object.Body?.transformToByteArray();
      if (!bytes) return null;
      return { contentType: object.ContentType ?? "application/octet-stream", bytes };
    },
  });
}

let service: BusinessCardService | null = null;
function cards(): BusinessCardService {
  service ??= buildService();
  return service;
}

function clientIp(event: { requestContext: { http: { sourceIp?: string } } }): string {
  return event.requestContext.http.sourceIp || "unknown";
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath.replace(/\/+$/, "") || "/";
    const ip = clientIp(event);
    const svc = cards();

    const slug = path.match(/\/api\/public\/business-cards\/by-slug\/([^/]+)$/);
    if (slug && method === "GET") {
      if (consumeRateLimit(`profile:${ip}`, 60)) return withCorrelationHeaders(event, jsonStatus({ error: "rate_limited" }, 429));
      const card = await svc.publicBySlug(decodeURIComponent(slug[1]));
      return withCorrelationHeaders(event, ok(card));
    }

    const vcard = path.match(/\/api\/public\/business-cards\/([^/]+)\/contact\.vcf$/);
    if (vcard && method === "GET") {
      if (consumeRateLimit(`vcard:${ip}`, 20)) return withCorrelationHeaders(event, jsonStatus({ error: "rate_limited" }, 429));
      const file = await svc.vcardForPublicId(vcard[1]);
      return withCorrelationHeaders(event, {
        statusCode: 200,
        headers: {
          "Content-Type": "text/vcard; charset=utf-8",
          "Content-Disposition": `attachment; filename="${file.fileName}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
        body: file.body,
      });
    }

    const eventPath = path.match(/\/api\/public\/business-cards\/([^/]+)\/event$/);
    if (eventPath && method === "POST") {
      if (consumeRateLimit(`event:${ip}`, 30)) return withCorrelationHeaders(event, jsonStatus({ error: "rate_limited" }, 429));
      const parsed = EventSchema.safeParse(readJson(event));
      if (!parsed.success) return withCorrelationHeaders(event, zodFailure(parsed.error));
      await svc.recordEvent({
        publicProfileId: eventPath[1],
        eventType: parsed.data.eventType,
        sourceType: parsed.data.sourceType,
        cardId: parsed.data.cardId,
        userAgent: event.headers?.["user-agent"],
        referrer: event.headers?.referer,
      });
      return withCorrelationHeaders(event, jsonStatus({ ok: true }, 202));
    }

    const profile = path.match(/\/api\/public\/business-cards\/([^/]+)$/);
    if (profile && method === "GET") {
      if (consumeRateLimit(`profile:${ip}`, 60)) return withCorrelationHeaders(event, jsonStatus({ error: "rate_limited" }, 429));
      return withCorrelationHeaders(event, ok(await svc.publicById(profile[1])));
    }

    const nfc = path.match(/\/api\/public\/c\/([^/]+)$/);
    if (nfc && method === "GET") {
      if (consumeRateLimit(`nfc:${ip}`, 60)) return withCorrelationHeaders(event, jsonStatus({ error: "rate_limited" }, 429));
      const resolved = await svc.resolveNfc(nfc[1]);
      if (resolved.profile) {
        try {
          await svc.recordEvent({
            publicProfileId: resolved.profile.publicProfileId,
            eventType: "page_view",
            sourceType: "nfc",
            cardId: nfc[1],
            userAgent: event.headers?.["user-agent"],
          });
        } catch {
          // Analytics must not block the redirect.
        }
      }
      return withCorrelationHeaders(event, {
        statusCode: 302,
        headers: {
          Location: resolved.location,
          "Cache-Control": "no-cache",
        },
        body: "",
      });
    }

    return withCorrelationHeaders(event, jsonStatus({ error: "not_found" }, 404));
  } catch (error) {
    return withCorrelationHeaders(event, mapBizCardError(error));
  }
};
