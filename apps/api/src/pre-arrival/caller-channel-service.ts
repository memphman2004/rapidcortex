import { randomBytes } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  assertCallerMediaContentType,
  callerChannelConfirmBodySchema,
  callerChannelLocationBodySchema,
  callerChannelTextBodySchema,
  callerChannelUploadBodySchema,
  classifyPreArrivalSessionMode,
  dispatcherChannelReplySchema,
  toCallerChannelPublicItem,
  type CallerChannelMessage,
  type CallerChannelPublicItem,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callerChannelStore } from "./caller-channel-store.js";
import { preArrivalSessionStore } from "./session-store.js";

const auditRepo = new AuditRepository();
const s3 = new S3Client({});
const MAX_MESSAGES = 40;

function makeId(): string {
  return `msg_${randomBytes(6).toString("hex")}`;
}

async function requireFullSession(sessionToken: string) {
  const session = await preArrivalSessionStore.getByToken(sessionToken);
  if (!session) throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  if (session.status === "terminated" || session.status === "ended") {
    throw Object.assign(new Error("SESSION_ENDED"), { statusCode: 409 });
  }
  if (session.ttl && session.ttl < Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error("SESSION_EXPIRED"), { statusCode: 410 });
  }
  const mode = session.sessionMode ?? classifyPreArrivalSessionMode(session.cadNatureCode);
  if (mode !== "FULL") {
    throw Object.assign(new Error("CHANNEL_NOT_AVAILABLE"), { statusCode: 403 });
  }
  return session;
}

async function assertRoom(agencyId: string, sessionToken: string): Promise<void> {
  const existing = await callerChannelStore.list(agencyId, sessionToken, MAX_MESSAGES + 1);
  if (existing.length >= MAX_MESSAGES) {
    throw Object.assign(new Error("VALIDATION:Message limit reached"), { statusCode: 400 });
  }
}

async function auditMessage(message: CallerChannelMessage, actorId: string): Promise<void> {
  try {
    await auditRepo.create({
      eventId: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      agencyId: message.agencyId,
      incidentId: message.incidentId,
      actorId,
      type: AUDIT_EVENT_TYPES.PRE_ARRIVAL_CALLER_MESSAGE,
      details: { kind: message.kind, from: message.from, messageId: message.messageId },
      createdAt: message.createdAt,
      resourceType: "session",
      resourceId: message.sessionToken,
    });
  } catch {
    /* audit must not abort the message */
  }
}

export async function listPublicChannel(sessionToken: string): Promise<CallerChannelPublicItem[]> {
  const session = await requireFullSession(sessionToken);
  const rows = await callerChannelStore.list(session.agencyId, session.sessionToken);
  return rows.flatMap((row) => {
    const item = toCallerChannelPublicItem(row);
    return item ? [item] : [];
  });
}

export async function postCallerChannel(sessionToken: string, body: unknown): Promise<CallerChannelPublicItem> {
  const session = await requireFullSession(sessionToken);
  await assertRoom(session.agencyId, session.sessionToken);
  const text = callerChannelTextBodySchema.safeParse(body);
  const location = callerChannelLocationBodySchema.safeParse(body);
  if (!text.success && !location.success) {
    throw Object.assign(new Error("VALIDATION:Send text or a location"), { statusCode: 400 });
  }
  const now = new Date().toISOString();
  const message: CallerChannelMessage = {
    messageId: makeId(),
    agencyId: session.agencyId,
    incidentId: session.incidentId,
    sessionToken: session.sessionToken,
    kind: text.success ? "text" : "location",
    from: "caller",
    createdAt: now,
    ...(text.success ? { text: text.data.text } : {}),
    ...(location.success
      ? {
          latitude: location.data.latitude,
          longitude: location.data.longitude,
          accuracyMeters: location.data.accuracyMeters,
        }
      : {}),
  };
  await callerChannelStore.put(message);
  await auditMessage(message, "caller:public");
  const item = toCallerChannelPublicItem(message);
  if (!item) throw Object.assign(new Error("VALIDATION:Message was not accepted"), { statusCode: 400 });
  return item;
}

export async function issueCallerMediaUpload(sessionToken: string, body: unknown) {
  const session = await requireFullSession(sessionToken);
  const parsed = callerChannelUploadBodySchema.safeParse(body);
  if (!parsed.success) throw Object.assign(new Error(`VALIDATION:${parsed.error.message}`), { statusCode: 400 });
  assertCallerMediaContentType(parsed.data.kind, parsed.data.contentType, parsed.data.byteSize);
  await assertRoom(session.agencyId, session.sessionToken);
  const now = new Date().toISOString();
  const messageId = makeId();
  const safeName = parsed.data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  const s3Key = `pre-arrival/${session.agencyId}/${session.sessionToken}/${messageId}/${safeName}`;
  const message: CallerChannelMessage = {
    messageId,
    agencyId: session.agencyId,
    incidentId: session.incidentId,
    sessionToken: session.sessionToken,
    kind: parsed.data.kind,
    from: "caller",
    contentType: parsed.data.contentType,
    byteSize: parsed.data.byteSize,
    s3Key,
    mediaStatus: "pending",
    createdAt: now,
  };
  await callerChannelStore.put(message);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.assetsBucket,
      Key: s3Key,
      ContentType: parsed.data.contentType,
    }),
    { expiresIn: 120 },
  );
  return { messageId, uploadUrl, headers: { "Content-Type": parsed.data.contentType } };
}

export async function confirmCallerMedia(sessionToken: string, body: unknown): Promise<CallerChannelPublicItem> {
  const session = await requireFullSession(sessionToken);
  const parsed = callerChannelConfirmBodySchema.safeParse(body);
  if (!parsed.success) throw Object.assign(new Error(`VALIDATION:${parsed.error.message}`), { statusCode: 400 });
  const rows = await callerChannelStore.list(session.agencyId, session.sessionToken);
  const message = rows.find((row) => row.messageId === parsed.data.messageId);
  if (!message || !message.s3Key || message.from !== "caller") {
    throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  }
  await s3.send(new HeadObjectCommand({ Bucket: env.assetsBucket, Key: message.s3Key }));
  await callerChannelStore.markReady(session.agencyId, session.sessionToken, message.createdAt, message.messageId);
  const ready = { ...message, mediaStatus: "ready" as const };
  await auditMessage(ready, "caller:public");
  const item = toCallerChannelPublicItem(ready);
  if (!item) throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  return item;
}

export async function listDispatcherChannel(incidentId: string, sessionToken: string, agencyId: string) {
  const session = await preArrivalSessionStore.getForAgency(sessionToken, agencyId);
  if (!session || session.incidentId !== incidentId) {
    throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  }
  const rows = await callerChannelStore.list(agencyId, sessionToken);
  const ready = rows.filter((row) => row.mediaStatus !== "pending");
  const withUrls = await Promise.all(
    ready.map(async (row) => {
      if (!row.s3Key || row.mediaStatus !== "ready") return { ...row, viewUrl: undefined as string | undefined };
      const viewUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: env.assetsBucket, Key: row.s3Key }),
        { expiresIn: 300 },
      );
      return { ...row, viewUrl };
    }),
  );
  return { messages: withUrls };
}

export async function postDispatcherReply(
  incidentId: string,
  sessionToken: string,
  agencyId: string,
  userId: string,
  body: unknown,
): Promise<CallerChannelMessage> {
  const session = await preArrivalSessionStore.getForAgency(sessionToken, agencyId);
  if (!session || session.incidentId !== incidentId) {
    throw Object.assign(new Error("NOT_FOUND"), { statusCode: 404 });
  }
  const mode = session.sessionMode ?? classifyPreArrivalSessionMode(session.cadNatureCode);
  if (mode !== "FULL" || session.status === "ended" || session.status === "terminated") {
    throw Object.assign(new Error("CHANNEL_NOT_AVAILABLE"), { statusCode: 403 });
  }
  const parsed = dispatcherChannelReplySchema.safeParse(body);
  if (!parsed.success) throw Object.assign(new Error(`VALIDATION:${parsed.error.message}`), { statusCode: 400 });
  await assertRoom(agencyId, sessionToken);
  const message: CallerChannelMessage = {
    messageId: makeId(),
    agencyId,
    incidentId,
    sessionToken,
    kind: "dispatcher_text",
    from: "dispatcher",
    text: parsed.data.text,
    createdAt: new Date().toISOString(),
  };
  await callerChannelStore.put(message);
  await auditMessage(message, userId);
  return message;
}
