import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AuthorizationService } from "rapid-cortex-security";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { AgencyScopeResolver } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  ok,
  serverError,
  serviceUnavailable,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { env } from "../../lib/env.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { makeId } from "../../lib/ids.js";

const bodySchema = z.object({
  fileName: z.string().min(1).max(200).optional(),
  contentType: z.string().min(1).max(120).default("text/plain"),
});

const s3 = new S3Client({ region: env.region });
const authz = new AuthorizationService();
const auditRepo = new AuditRepository();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    if (!env.enableSopProtocolAi) {
      return serviceUnavailable("SOP protocol detection is not enabled for this deployment");
    }
    const agencyId = event.pathParameters?.id;
    if (!agencyId) return badRequest("Agency id required");

    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    if (!authz.canAccessAdminRoutes(user)) return forbidden();

    AgencyScopeResolver.assertCanReadAgencyProfile(user, agencyId);

    const parsed = bodySchema.safeParse(JSON.parse(event.body ?? "{}"));
    if (!parsed.success) return badRequestFromZod(parsed.error);

    const safeName = (parsed.data.fileName ?? `sop-${randomUUID()}.txt`).replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );
    const key = `agency-sop/${agencyId}/${safeName}`;

    const put = new PutObjectCommand({
      Bucket: env.assetsBucket,
      Key: key,
      ContentType: parsed.data.contentType,
    });
    const uploadUrl = await getSignedUrl(s3, put, { expiresIn: env.sopUploadUrlTtlSeconds });

    const now = new Date().toISOString();
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SOP_UPLOAD_URL_ISSUED,
      details: { sopUploadPresign: true, key },
      createdAt: now,
      resourceType: "agency",
      resourceId: agencyId,
    });

    return ok({ uploadUrl, key, expiresInSeconds: env.sopUploadUrlTtlSeconds });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return forbidden();
    return serverError();
  }
};
