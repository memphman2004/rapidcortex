import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import QRCode from "qrcode";
import { z } from "zod";
import { getUserContext } from "../../lib/auth.js";
import { consumeRateLimit, isPlatformCardAgency, NEXCORT_COMPANY_NAME } from "../../lib/business-cards/domain.js";
import { DynamoBizCardRepo } from "../../lib/business-cards/dynamo-repo.js";
import {
  AssignCardSchema,
  CardStatusSchema,
  CreateCardSchema,
  DraftSchema,
  LocksSchema,
  PhotoSchema,
  RevokeCardSchema,
  SettingsSchema,
  StatusSchema,
} from "../../lib/business-cards/schemas.js";
import { BusinessCardService, type Actor } from "../../lib/business-cards/service.js";
import type { BusinessCardProfile } from "../../lib/business-cards/types.js";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { authFailure, jsonStatus, ok } from "../../lib/response.js";
import { AgencyRepository } from "../../repositories/agencyRepository.js";
import { mapBizCardError, presentCard, presentProfile, readJson, zodFailure } from "./present.js";

const s3 = new S3Client({
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

function buildService(): BusinessCardService {
  const table = process.env.BIZCARD_TABLE_NAME?.trim();
  if (!table) throw new Error("BIZCARD_TABLE_NAME is not set");
  const domain = process.env.BIZCARD_CLOUDFRONT_DOMAIN?.trim();
  return new BusinessCardService(new DynamoBizCardRepo(table), {
    globalEnabled: process.env.ENABLE_BUSINESS_CARDS === "true" || process.env.ENABLE_BUSINESS_CARDS === "1",
    publicBaseUrl: process.env.BIZCARD_PUBLIC_BASE_URL?.trim() || "https://www.nexcortiq.us",
    photoBaseUrl: domain ? `https://${domain}` : undefined,
    resolveCompany: async (tenantId) => {
      if (isPlatformCardAgency(tenantId)) return { name: NEXCORT_COMPANY_NAME, website: "https://www.nexcortiq.us" };
      try {
        const agency = await new AgencyRepository().get(tenantId);
        const name = agency?.name?.trim();
        return name ? { name } : { name: NEXCORT_COMPANY_NAME };
      } catch {
        return { name: NEXCORT_COMPANY_NAME };
      }
    },
  });
}

let service: BusinessCardService | null = null;
function cards(): BusinessCardService {
  service ??= buildService();
  return service;
}

function actorOf(user: { userId: string; agencyId: string; role: string; email: string; displayName?: string }): Actor {
  return {
    userId: user.userId,
    tenantId: user.agencyId,
    role: user.role,
    email: user.email,
    displayName: user.displayName,
  };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const user = await getUserContext(event);
  if (!user) return withCorrelationHeaders(event, authFailure(event));
  try {
    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath.replace(/\/+$/, "") || "/";
    const actor = actorOf(user);
    const result = await route(
      method,
      path,
      actor,
      event.body ? readJson(event) : {},
      event.queryStringParameters?.cursor,
      event.queryStringParameters?.purpose,
    );
    return withCorrelationHeaders(event, result);
  } catch (error) {
    return withCorrelationHeaders(event, mapBizCardError(error));
  }
};

async function route(method: string, path: string, actor: Actor, body: unknown, cursor?: string, purpose?: string) {
  const svc = cards();
  if (method === "GET" && path.endsWith("/api/business-cards/status")) {
    return ok(await svc.getStatus(actor));
  }
  if (method === "GET" && path.endsWith("/api/business-cards/me/analytics")) {
    return ok(await svc.analyticsFor(actor));
  }
  if (method === "GET" && path.endsWith("/api/business-cards/me/qr")) {
    const profile = await svc.getMine(actor);
    const url = `${process.env.BIZCARD_PUBLIC_BASE_URL?.replace(/\/$/, "") || "https://www.nexcortiq.us"}/card/${profile.slug}`;
    const [pngDataUrl, downloadPngDataUrl, svgString] = await Promise.all([
      QRCode.toDataURL(url, { width: 300, margin: 1 }),
      QRCode.toDataURL(url, { width: 1200, margin: 1 }),
      QRCode.toString(url, { type: "svg", margin: 1 }),
    ]);
    return ok({ pngDataUrl, downloadPngDataUrl, svgString, url });
  }
  if (method === "POST" && path.endsWith("/api/business-cards/me/photo/complete")) {
    return completePhoto(actor, body, false);
  }
  if (method === "POST" && path.endsWith("/api/business-cards/me/photo")) {
    if (consumeRateLimit(`photo:${actor.userId}`, 5)) {
      return jsonStatus({ error: "rate_limited" }, 429);
    }
    return presign(actor, body, false);
  }
  if (method === "DELETE" && path.endsWith("/api/business-cards/me/photo")) {
    const profile = await svc.getMine(actor);
    if (purpose === "cover") {
      await svc.setCoverKey(actor, profile.profileId, undefined, false);
    } else {
      await svc.setPhotoKey(actor, profile.profileId, undefined, false);
    }
    return ok({ removed: true });
  }
  if (method === "POST" && path.endsWith("/api/business-cards/me/publish")) {
    return ok(await presentWithPhoto(await svc.publishMine(actor)));
  }
  if (method === "GET" && path.endsWith("/api/business-cards/me")) {
    return ok(await presentWithPhoto(await svc.getMine(actor)));
  }
  if (method === "PUT" && path.endsWith("/api/business-cards/me")) {
    const parsed = DraftSchema.safeParse(body);
    if (!parsed.success) return zodFailure(parsed.error);
    return ok(await presentWithPhoto(await svc.saveMine(actor, parsed.data)));
  }
  if (method === "GET" && path.endsWith("/api/admin/business-cards/settings")) {
    return ok((await svc.getSettings(actor)) ?? { enabled: false, version: 0 });
  }
  if (method === "PUT" && path.endsWith("/api/admin/business-cards/settings")) {
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) return zodFailure(parsed.error);
    return ok(await svc.saveSettings(actor, parsed.data));
  }
  if (method === "GET" && path.endsWith("/api/admin/business-cards/audit")) {
    return ok({ items: await svc.auditFor(actor) });
  }
  if (method === "GET" && path.endsWith("/api/admin/analytics/business-cards")) {
    return ok(await svc.tenantAnalytics(actor));
  }
  if (method === "GET" && path.endsWith("/api/admin/business-cards")) {
    const page = await svc.listAdmin(actor, cursor);
    return ok({ items: page.items.map(presentProfile), cursor: page.cursor });
  }
  if (method === "POST" && path.endsWith("/api/admin/business-cards")) {
    const parsed = DraftSchema.safeParse(body);
    if (!parsed.success) return zodFailure(parsed.error);
    if (!parsed.data.cognitoUserId) return jsonStatus({ error: "cognitoUserId_required" }, 400);
    return jsonStatus(await presentWithPhoto(await svc.adminCreate(actor, parsed.data.cognitoUserId, parsed.data)), 201);
  }
  if (method === "GET" && path.endsWith("/api/admin/nfc-cards")) {
    return ok({ items: (await svc.listCards(actor)).map(presentCard) });
  }
  if (method === "POST" && path.endsWith("/api/admin/nfc-cards")) {
    const parsed = CreateCardSchema.safeParse(body);
    if (!parsed.success) return zodFailure(parsed.error);
    return jsonStatus(presentCard(await svc.createCard(actor, parsed.data.tagType)), 201);
  }

  const profileAction = path.match(
    /\/api\/admin\/business-cards\/([^/]+)(?:\/(photo\/complete|photo|status|locks|analytics|audit))?$/,
  );
  if (profileAction && profileAction[1] !== "settings" && profileAction[1] !== "audit") {
    const profileId = profileAction[1];
    const action = profileAction[2];
    if (!action && method === "GET") return ok(await presentWithPhoto(await svc.getAdmin(actor, profileId)));
    if (!action && method === "PUT") {
      const parsed = DraftSchema.safeParse(body);
      if (!parsed.success) return zodFailure(parsed.error);
      return ok(await presentWithPhoto(await svc.adminUpdate(actor, profileId, parsed.data)));
    }
    if (action === "photo/complete" && method === "POST") return completePhoto(actor, body, true, profileId);
    if (action === "photo" && method === "POST") return presign(actor, body, true, profileId);
    if (action === "photo" && method === "DELETE") {
      if (purpose === "cover") await svc.setCoverKey(actor, profileId, undefined, true);
      else await svc.setPhotoKey(actor, profileId, undefined, true);
      return ok({ removed: true });
    }
    if (action === "status" && method === "PATCH") {
      const parsed = StatusSchema.safeParse(body);
      if (!parsed.success) return zodFailure(parsed.error);
      return ok(
        await presentWithPhoto(
          await svc.adminSetStatus(actor, profileId, parsed.data.status, parsed.data.reason, parsed.data.version),
        ),
      );
    }
    if (action === "locks" && method === "PATCH") {
      const parsed = LocksSchema.safeParse(body);
      if (!parsed.success) return zodFailure(parsed.error);
      return ok(await presentWithPhoto(await svc.adminSetLocks(actor, profileId, parsed.data.lockedFields)));
    }
    if (action === "analytics" && method === "GET") return ok(await svc.analyticsFor(actor, profileId));
    if (action === "audit" && method === "GET") return ok({ items: await svc.auditFor(actor, profileId) });
  }

  const cardAction = path.match(/\/api\/admin\/nfc-cards\/([^/]+)(?:\/(assign|revoke|status))?$/);
  if (cardAction) {
    const cardId = cardAction[1];
    const action = cardAction[2];
    if (!action && method === "GET") return ok(presentCard(await svc.getCard(actor, cardId)));
    if (action === "assign" && method === "PATCH") {
      const parsed = AssignCardSchema.safeParse(body);
      if (!parsed.success) return zodFailure(parsed.error);
      return ok(presentCard(await svc.assignCard(actor, cardId, parsed.data.profileId, parsed.data.version)));
    }
    if (action === "revoke" && method === "PATCH") {
      const parsed = RevokeCardSchema.safeParse(body);
      if (!parsed.success) return zodFailure(parsed.error);
      return ok(presentCard(await svc.revokeCard(actor, cardId, parsed.data.reason, parsed.data.version)));
    }
    if (action === "status" && method === "PATCH") {
      const parsed = CardStatusSchema.safeParse(body);
      if (!parsed.success) return zodFailure(parsed.error);
      return ok(presentCard(await svc.setCardStatus(actor, cardId, parsed.data.status, parsed.data.version)));
    }
  }

  return jsonStatus({ error: "not_found" }, 404);
}

async function readableAsset(key?: string): Promise<string | undefined> {
  if (!key) return undefined;
  const domain = process.env.BIZCARD_CLOUDFRONT_DOMAIN?.trim();
  if (domain) return `https://${domain}/${key}`;
  const bucket = process.env.BIZCARD_PHOTO_BUCKET?.trim();
  if (!bucket) return undefined;
  try {
    return await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
  } catch {
    return undefined;
  }
}

async function presentWithPhoto(profile: BusinessCardProfile) {
  const body = presentProfile(profile);
  const [photoUrl, coverUrl] = await Promise.all([readableAsset(profile.photoKey), readableAsset(profile.coverKey)]);
  return { ...body, ...(photoUrl ? { photoUrl } : {}), ...(coverUrl ? { coverUrl } : {}) };
}

async function presign(actor: Actor, body: unknown, asAdmin: boolean, profileId?: string) {
  const parsed = PhotoSchema.safeParse(body);
  if (!parsed.success) return zodFailure(parsed.error);
  const bucket = process.env.BIZCARD_PHOTO_BUCKET?.trim();
  if (!bucket) return jsonStatus({ error: "photo_bucket_unconfigured" }, 503);
  const svc = cards();
  const profile = asAdmin && profileId ? await svc.getAdmin(actor, profileId) : await svc.getMine(actor);
  const target = svc.photoTarget(actor, profile, parsed.data.contentType);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: target.key,
      ContentType: parsed.data.contentType,
      ContentLength: parsed.data.contentLength,
    }),
    { expiresIn: 300 },
  );
  return ok({ uploadUrl, key: target.key, expiresIn: 300 });
}

async function completePhoto(actor: Actor, body: unknown, asAdmin: boolean, profileId?: string) {
  const parsed = z.object({
    key: z.string().min(8).max(300),
    purpose: z.enum(["profile", "cover"]).optional(),
  }).safeParse(body);
  if (!parsed.success) return zodFailure(parsed.error);
  const svc = cards();
  const profile = asAdmin && profileId ? await svc.getAdmin(actor, profileId) : await svc.getMine(actor);
  const prefix = `biz-cards/${actor.tenantId}/${profile.profileId}/`;
  if (!parsed.data.key.startsWith(prefix)) {
    return jsonStatus({ error: "invalid_key" }, 400);
  }
  if (parsed.data.purpose === "cover") await svc.setCoverKey(actor, profile.profileId, parsed.data.key, asAdmin);
  else await svc.setPhotoKey(actor, profile.profileId, parsed.data.key, asAdmin);
  return ok({ key: parsed.data.key });
}
