import { createHash, randomBytes } from "node:crypto";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AUDIT_EVENT_TYPES, AuthorizationService, TenantAccessGuard } from "rapid-cortex-security";
import type {
  CallerMediaSendLinkBody,
  CallerMediaUploadUrlBody,
  CallerMediaUploadUrlResponse,
  IncidentMediaConfirmInput,
  IncidentMediaListItem,
  IncidentMediaPublicMeta,
  IncidentMediaRecord,
  IncidentMediaUploadUrlInput,
  RequestIncidentMediaInput,
  SmsSendResult,
  UserContext,
} from "rapid-cortex-shared";
import {
  incidentMediaConfirmBodySchema,
  incidentMediaUploadUrlBodySchema,
  PLATFORM_AGENCY_ID,
} from "rapid-cortex-shared";
import { isSupervisorOrAdmin } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { sendIncidentMediaLinkSms } from "./sms/smsProviderFactory.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { AgencyRepository } from "../repositories/agencyRepository.js";
import { IncidentMediaRepository } from "../repositories/incidentMediaRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import { buildMediaDedupe, buildRetentionFields } from "../lib/retentionPolicy.js";

const authz = new AuthorizationService();
const repo = new IncidentMediaRepository();
const incidents = new IncidentRepository();
const agencies = new AgencyRepository();
const auditRepo = new AuditRepository();
const s3 = new S3Client({});

function canRequestCallerMedia(user: UserContext): boolean {
  return (
    user.role === "dispatcher" ||
    user.role === "supervisor" ||
    user.role === "agencyadmin" ||
    user.role === "rcsuperadmin"
  );
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertMediaInfra(user?: UserContext): void {
  if (!env.enableIncidentMedia) throw new Error("INCIDENT_MEDIA_DISABLED");
  if (!env.incidentMediaTable) throw new Error("INCIDENT_MEDIA_TABLE_NOT_CONFIGURED");
  if (user && user.agencyId === PLATFORM_AGENCY_ID) {
    const err = new Error("FORBIDDEN");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

function toListItem(row: IncidentMediaRecord): IncidentMediaListItem {
  const { tokenHash: _t, ...rest } = row;
  return rest;
}

function sanitizeFileBase(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload.bin";
}

function assertContentTypeAllowed(ct: string): void {
  const lower = ct.toLowerCase();
  if (
    lower.startsWith("image/") ||
    lower.startsWith("video/") ||
    lower === "application/pdf" ||
    lower.startsWith("audio/")
  ) {
    return;
  }
  const err = new Error("VALIDATION:Unsupported content type for incident media");
  (err as Error & { statusCode?: number }).statusCode = 400;
  throw err;
}

function assertNotExpired(row: IncidentMediaRecord): void {
  if (Date.parse(row.expiresAt) < Date.now()) {
    const err = new Error("MEDIA_EXPIRED");
    (err as Error & { statusCode?: number }).statusCode = 410;
    throw err;
  }
}

function expectedKeyPrefix(row: IncidentMediaRecord): string {
  return `incident-media/${row.agencyId}/${row.incidentId}/${row.mediaId}/`;
}

export class MediaService {
  async requestMedia(
    incidentId: string,
    user: UserContext,
    body: RequestIncidentMediaInput,
  ): Promise<{
    media: IncidentMediaListItem;
    smsOutcome: {
      provider: SmsSendResult["provider"];
      dispatchStatus: SmsSendResult["status"];
      tokenExpiresAt: string;
      errorCode?: string;
    };
  }> {
    assertMediaInfra(user);
    if (!authz.canDispatch(user) || user.role === "auditor") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (!canRequestCallerMedia(user)) {
      const err = new Error("FORBIDDEN_ROLE");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const incident = TenantAccessGuard.assertIncidentAccess(await incidents.get(incidentId), user);

    const mediaId = makeId("med");
    const token = newOpaqueToken();
    const tokenHash = hashToken(token);
    const ts = nowIso();
    const ttlSeconds =
      env.mediaUploadTokenTtlSeconds > 0
        ? env.mediaUploadTokenTtlSeconds
        : (body.ttlMinutes ?? env.incidentMediaTokenTtlMinutes) * 60;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    const ttl = Math.floor(Date.parse(expiresAt) / 1000);

    const base =
      body.publicAppBaseUrl?.replace(/\/$/, "") ||
      env.incidentMediaPublicBaseUrl?.replace(/\/$/, "") ||
      "";
    if (!base) {
      const err = new Error("MISSING_PUBLIC_BASE_URL");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const path = `/media/upload/${encodeURIComponent(token)}`;
    const publicUrl = `${base}${path}`;
    /** Short, consent-oriented, incident-scoped copy (toll-free / transactional SMS). No CAD or PII. */
    const msg = `Rapid Cortex: A dispatcher requested a secure incident media upload link. Sharing is optional. Open: ${publicUrl}`;

    const sms = await sendIncidentMediaLinkSms(
      {
        smsProvider: env.smsProvider,
        smsPrimaryProvider: env.smsPrimaryProvider,
        deploymentStage: env.deploymentStage,
        incidentMediaSmsMock: env.incidentMediaSmsMock,
        mockSmsProvider: env.mockSmsProvider,
        awsRegion: env.region,
        awsSmsRegion: env.awsSmsRegion,
        awsSmsUseSimulator: env.awsSmsUseSimulator,
        twilioSecretArn: env.incidentMediaTwilioSecretArn,
        awsSmsConfigurationSetName: env.awsSmsConfigurationSetName,
        awsSmsPoolId: env.awsSmsPoolId,
      },
      {
        toPhoneE164: body.callerPhoneE164,
        messageBody: msg,
        agencyId: incident.agencyId,
        incidentId,
        messageType: "media_upload",
      },
    );

    const smsOk = sms.status === "sent";
    const tenant = await agencies.get(incident.agencyId);
    const ret = buildRetentionFields("media", {
      agencyConfig: tenant?.config,
      anchorIso: ts,
      policyId: env.defaultRetentionPolicyId,
      dedupe: buildMediaDedupe(incident.agencyId, mediaId),
      envDefaults: env,
    });
    const row: IncidentMediaRecord = {
      agencyId: incident.agencyId,
      mediaId,
      incidentId,
      tokenHash,
      status: smsOk ? "link_sent" : "sms_failed",
      callerPhoneE164: body.callerPhoneE164,
      requestedByUserId: user.userId,
      createdAt: ts,
      updatedAt: ts,
      expiresAt,
      ttl,
      smsSentAt: smsOk ? ts : null,
      smsProviderRef: sms.messageId ?? null,
      smsProvider: sms.provider,
      smsMessageId: sms.messageId ?? null,
      smsDispatchStatus: sms.status,
      smsStatus: sms.status,
      smsErrorCode: sms.errorCode ?? null,
      smsFailoverUsed: sms.smsFailoverUsed === true,
      lastError: smsOk ? null : sms.errorMessage ?? "SMS_SEND_FAILED",
      mediaType: body.mediaType ?? null,
      ...ret,
    };

    await repo.put(row);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: row.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.INCIDENT_MEDIA_REQUESTED,
      details: {
        mediaId,
        smsOk,
        smsProvider: sms.provider,
        smsDispatchStatus: sms.status,
        smsErrorCode: sms.errorCode,
        recipientRedacted: sms.recipientRedacted,
      },
      createdAt: ts,
      resourceType: "incident",
      resourceId: incidentId,
    });
    if (smsOk) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: row.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.INCIDENT_MEDIA_SMS_SENT,
        details: {
          mediaId,
          smsProvider: sms.provider,
          smsMessageId: sms.messageId,
          recipientRedacted: sms.recipientRedacted,
          smsFailoverUsed: sms.smsFailoverUsed === true,
        },
        createdAt: ts,
        resourceType: "incident",
        resourceId: incidentId,
      });
    } else {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: row.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.INCIDENT_MEDIA_SMS_FAILED,
        details: {
          mediaId,
          errorCode: sms.errorCode,
          lastProvider: sms.provider,
          smsFailoverUsed: sms.smsFailoverUsed === true,
          firstAttemptErrorCode: sms.firstAttemptErrorCode,
          recipientRedacted: sms.recipientRedacted,
        },
        createdAt: ts,
        resourceType: "incident",
        resourceId: incidentId,
      });
    }

    return {
      media: toListItem(row),
      smsOutcome: {
        provider: sms.provider,
        dispatchStatus: sms.status,
        tokenExpiresAt: row.expiresAt,
        ...(sms.errorCode ? { errorCode: sms.errorCode } : {}),
      },
    };
  }

  async listForIncident(incidentId: string, user: UserContext): Promise<{ items: IncidentMediaListItem[] }> {
    assertMediaInfra(user);
    if (!authz.canDispatch(user)) {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const incident = TenantAccessGuard.assertIncidentAccess(await incidents.get(incidentId), user);

    const rows = await repo.listByIncident(user.agencyId, incidentId);
    const items: IncidentMediaListItem[] = [];
    for (const row of rows) {
      if (row.status === "deleted") continue;
      let current = row;
      if ((row.status === "pending" || row.status === "upload_url_issued") && row.s3Key) {
        try {
          await s3.send(new HeadObjectCommand({ Bucket: env.assetsBucket, Key: row.s3Key }));
          const ts = nowIso();
          current = { ...row, status: "uploaded", updatedAt: ts };
          await repo.put(current);
        } catch {
          // still pending
        }
      }
      const item = toListItem(current);
      if (current.status === "uploaded" && current.s3Key) {
        const url = await this.presignedGet(current.s3Key, 3600);
        items.push({ ...item, downloadUrl: url });
      } else {
        items.push(item);
      }
    }
    return { items };
  }

  private async presignedGet(key: string, ttl: number): Promise<string> {
    const cmd = new GetObjectCommand({
      Bucket: env.assetsBucket,
      Key: key,
    });
    return getSignedUrl(s3, cmd, { expiresIn: ttl });
  }

  async getPublicMeta(rawToken: string): Promise<IncidentMediaPublicMeta> {
    assertMediaInfra();
    const tokenHash = hashToken(decodeURIComponent(rawToken));
    const row = await repo.getByTokenHash(tokenHash);
    if (!row) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertNotExpired(row);
    return {
      status: row.status,
      expiresAt: row.expiresAt,
      consentVersion: "v1",
    };
  }

  async issueUploadUrl(rawToken: string, rawBody: unknown): Promise<{
    uploadUrl: string;
    s3Key: string;
    headers: Record<string, string>;
    expiresInSeconds: number;
  }> {
    assertMediaInfra();
    const tokenHash = hashToken(decodeURIComponent(rawToken));
    const row = await repo.getByTokenHash(tokenHash);
    if (!row) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertNotExpired(row);
    if (row.status === "uploaded") {
      const err = new Error("ALREADY_UPLOADED");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }
    if (row.status === "canceled" || row.status === "expired") {
      const err = new Error("MEDIA_CLOSED");
      (err as Error & { statusCode?: number }).statusCode = 409;
      throw err;
    }

    const parsed = incidentMediaUploadUrlBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const err = new Error(`VALIDATION:${parsed.error.message}`);
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const body: IncidentMediaUploadUrlInput = parsed.data;
    if (body.byteSize > env.incidentMediaMaxUploadBytes) {
      const err = new Error("VALIDATION:File too large");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    assertContentTypeAllowed(body.contentType);

    const safe = sanitizeFileBase(body.fileName);
    const s3Key = `${expectedKeyPrefix(row)}${safe}`;
    const ts = nowIso();

    const next: IncidentMediaRecord = {
      ...row,
      status: "upload_url_issued",
      consentAt: ts,
      consentVersion: body.consent.consentVersion,
      uploadUrlIssuedAt: ts,
      s3Key,
      originalFileName: body.fileName,
      contentType: body.contentType,
      byteSize: body.byteSize,
      updatedAt: ts,
    };
    await repo.put(next);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: row.agencyId,
      incidentId: row.incidentId,
      actorId: "public",
      type: AUDIT_EVENT_TYPES.INCIDENT_MEDIA_UPLOAD_URL_ISSUED,
      details: { mediaId: row.mediaId, s3Key },
      createdAt: ts,
      resourceType: "incident",
      resourceId: row.incidentId,
    });

    const put = new PutObjectCommand({
      Bucket: env.assetsBucket,
      Key: s3Key,
      ContentType: body.contentType,
    });
    const uploadUrl = await getSignedUrl(s3, put, { expiresIn: env.incidentMediaUploadUrlTtlSeconds });

    return {
      uploadUrl,
      s3Key,
      headers: { "Content-Type": body.contentType },
      expiresInSeconds: env.incidentMediaUploadUrlTtlSeconds,
    };
  }

  async confirmUpload(rawToken: string, rawBody: unknown): Promise<IncidentMediaListItem> {
    assertMediaInfra();
    const tokenHash = hashToken(decodeURIComponent(rawToken));
    const row = await repo.getByTokenHash(tokenHash);
    if (!row) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    assertNotExpired(row);

    const parsed = incidentMediaConfirmBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      const err = new Error(`VALIDATION:${parsed.error.message}`);
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    const body: IncidentMediaConfirmInput = parsed.data;
    if (body.s3Key !== row.s3Key) {
      const err = new Error("S3_KEY_MISMATCH");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }
    if (!row.s3Key?.startsWith(expectedKeyPrefix(row))) {
      const err = new Error("S3_KEY_MISMATCH");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    try {
      await s3.send(
        new HeadObjectCommand({
          Bucket: env.assetsBucket,
          Key: body.s3Key,
        }),
      );
    } catch {
      const err = new Error("OBJECT_NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 400;
      throw err;
    }

    const ts = nowIso();
    const next: IncidentMediaRecord = {
      ...row,
      status: "uploaded",
      byteSize: body.byteSize,
      contentType: body.contentType,
      updatedAt: ts,
    };
    await repo.put(next);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: row.agencyId,
      incidentId: row.incidentId,
      actorId: "public",
      type: AUDIT_EVENT_TYPES.INCIDENT_MEDIA_UPLOAD_CONFIRMED,
      details: { mediaId: row.mediaId, s3Key: body.s3Key, byteSize: body.byteSize },
      createdAt: ts,
      resourceType: "incident",
      resourceId: row.incidentId,
    });

    return toListItem(next);
  }

  async sendMediaLink(
    incidentId: string,
    user: UserContext,
    body: CallerMediaSendLinkBody,
  ): Promise<{ sent: boolean; linkExpiresAt: string; mediaId: string }> {
    const mediaType =
      body.mediaType === "photo" ? ("photo" as const) : body.mediaType === "video" ? ("video_clip" as const) : undefined;
    const out = await this.requestMedia(incidentId, user, {
      callerPhoneE164: body.callerPhone,
      mediaType,
    });
    return {
      sent: out.smsOutcome.dispatchStatus === "sent",
      linkExpiresAt: out.smsOutcome.tokenExpiresAt,
      mediaId: out.media.mediaId,
    };
  }

  async issueDispatcherUploadUrl(
    incidentId: string,
    user: UserContext,
    body: CallerMediaUploadUrlBody,
  ): Promise<CallerMediaUploadUrlResponse> {
    assertMediaInfra(user);
    if (!authz.canDispatch(user) || user.role === "auditor") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    if (!canRequestCallerMedia(user)) {
      const err = new Error("FORBIDDEN_ROLE");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const incident = TenantAccessGuard.assertIncidentAccess(await incidents.get(incidentId), user);
    assertContentTypeAllowed(body.mimeType);

    const mediaId = makeId("med");
    const ts = nowIso();
    const expiresIn = 900;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const ttl = Math.floor(Date.parse(expiresAt) / 1000);
    const safe = sanitizeFileBase(body.fileName);
    const s3Key = `incident-media/${incident.agencyId}/${incidentId}/${mediaId}/${safe}`;
    const tokenHash = hashToken(`${mediaId}:${incident.agencyId}`);

    const tenant = await agencies.get(incident.agencyId);
    const ret = buildRetentionFields("media", {
      agencyConfig: tenant?.config,
      anchorIso: ts,
      policyId: env.defaultRetentionPolicyId,
      dedupe: buildMediaDedupe(incident.agencyId, mediaId),
      envDefaults: env,
    });

    const row: IncidentMediaRecord = {
      agencyId: incident.agencyId,
      mediaId,
      incidentId,
      tokenHash,
      status: "pending",
      callerPhoneE164: "+00000000000",
      requestedByUserId: user.userId,
      createdAt: ts,
      updatedAt: ts,
      expiresAt,
      ttl,
      s3Key,
      originalFileName: body.fileName,
      contentType: body.mimeType,
      mediaType: body.mediaType === "video" ? "video_clip" : "photo",
      ...ret,
    };
    await repo.put(row);

    const put = new PutObjectCommand({
      Bucket: env.assetsBucket,
      Key: s3Key,
      ContentType: body.mimeType,
      ServerSideEncryption: "AES256",
    });
    const uploadUrl = await getSignedUrl(s3, put, { expiresIn });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.INCIDENT_MEDIA_UPLOAD_URL_ISSUED,
      details: { mediaId, s3Key, dispatcher: true },
      createdAt: ts,
      resourceType: "incident",
      resourceId: incidentId,
    });

    return { uploadUrl, mediaId, expiresAt };
  }

  async softDeleteMedia(incidentId: string, mediaId: string, user: UserContext): Promise<void> {
    assertMediaInfra(user);
    if (!isSupervisorOrAdmin(user.role) && user.role !== "rcsuperadmin") {
      const err = new Error("FORBIDDEN");
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }
    const incident = TenantAccessGuard.assertIncidentAccess(await incidents.get(incidentId), user);
    const row = await repo.get(user.agencyId, mediaId);
    if (!row || row.incidentId !== incidentId) {
      const err = new Error("NOT_FOUND");
      (err as Error & { statusCode?: number }).statusCode = 404;
      throw err;
    }
    const ts = nowIso();
    await repo.put({ ...row, status: "deleted", updatedAt: ts });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: user.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.INCIDENT_MEDIA_CANCELED,
      details: { mediaId, softDelete: true },
      createdAt: ts,
      resourceType: "incident",
      resourceId: incidentId,
    });
  }
}
