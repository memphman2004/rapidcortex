import { createHash, randomBytes } from "node:crypto";
import type {
  CreateVideoAssistSessionBody,
  VideoAssistConsentBody,
  VideoAssistDispatcherSession,
  VideoAssistPublicSession,
  VideoAssistSessionEvent,
  VideoAssistSessionStatus,
  VideoAssistSignalBody,
  UserContext,
} from "rapid-cortex-shared";
import {
  createVideoAssistSessionBodySchema,
  videoAssistConsentBodySchema,
  videoAssistSignalBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, TenantAccessGuard } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { sendVideoAssistSms } from "../lib/videoAssistSms.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import type { VideoAssistDdbItem } from "../repositories/videoAssistRepository.js";
import { VideoAssistRepository } from "../repositories/videoAssistRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";

const repo = new VideoAssistRepository();
const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();

const MAX_EVENTS = 100;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function trimEvents(events: VideoAssistSessionEvent[]): VideoAssistSessionEvent[] {
  if (events.length <= MAX_EVENTS) return events;
  return events.slice(-MAX_EVENTS);
}

function append(item: VideoAssistDdbItem, ev: VideoAssistSessionEvent): VideoAssistDdbItem {
  const events = trimEvents([...item.events, ev]);
  return { ...item, events, updatedAt: new Date().toISOString() };
}

function toPublic(item: VideoAssistDdbItem): VideoAssistPublicSession {
  return {
    sessionId: item.sessionId,
    incidentId: item.incidentId,
    status: item.status as VideoAssistPublicSession["status"],
    expiresAt: item.expiresAt,
    allowMicrophone: item.allowMicrophone,
    callerLocale: item.callerLocale,
    callerOfferSdp: item.callerOfferSdp ?? null,
    dispatcherAnswerSdp: item.dispatcherAnswerSdp ?? null,
    iceDispatcher: item.iceDispatcher,
    iceCaller: item.iceCaller,
  };
}

function toDispatcher(item: VideoAssistDdbItem): VideoAssistDispatcherSession {
  return {
    ...toPublic(item),
    agencyId: item.agencyId,
    callerPhoneE164: item.callerPhoneE164,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    smsSentAt: item.smsSentAt ?? null,
    consentAt: item.consentAt ?? null,
    openedAt: item.openedAt ?? null,
    streamStartedAt: item.streamStartedAt ?? null,
    endedAt: item.endedAt ?? null,
    canceledAt: item.canceledAt ?? null,
    lastError: item.lastError ?? null,
    events: item.events,
  };
}

function assertConfigured(): void {
  if (!env.videoAssistTable) throw new Error("VIDEO_ASSIST_TABLE_NOT_CONFIGURED");
}

function assertLive(item: VideoAssistDdbItem): void {
  const now = Date.now();
  if (Date.parse(item.expiresAt) < now) throw new Error("SESSION_EXPIRED");
  if (item.canceledAt) throw new Error("SESSION_CANCELED");
  if (item.endedAt) throw new Error("SESSION_ENDED");
}

export class VideoAssistService {
  async createSession(incidentId: string, user: UserContext, rawBody: unknown) {
    assertConfigured();
    const parsed = createVideoAssistSessionBodySchema.safeParse(rawBody);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);

    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);

    const body: CreateVideoAssistSessionBody = parsed.data;
    const sessionId = makeId("vas");
    const token = newOpaqueToken();
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();
    const ttlMin = body.ttlMinutes ?? 60;
    const expiresAt = new Date(Date.now() + ttlMin * 60_000).toISOString();

    const base =
      body.publicAppBaseUrl?.replace(/\/$/, "") ||
      env.videoAssistPublicBaseUrl?.replace(/\/$/, "") ||
      "";
    if (!base) throw new Error("MISSING_PUBLIC_BASE_URL");

    const path = `/video-assist/${encodeURIComponent(token)}`;
    const publicUrl = `${base}${path}`;

    const msg = `Rapid Cortex: help responders with a brief live video. Open: ${publicUrl} (one-time link, expires soon).`;

    const sms = await sendVideoAssistSms({
      phoneE164: body.callerPhoneE164,
      message: msg,
    });

    const item: VideoAssistDdbItem = {
      sessionId,
      tokenHash,
      agencyId: incident.agencyId,
      incidentId,
      status: sms.ok ? "sms_sent" : "failed",
      callerPhoneE164: body.callerPhoneE164,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      callerLocale: body.callerLocale,
      allowMicrophone: true,
      iceCaller: [],
      iceDispatcher: [],
      events: [],
      smsSentAt: sms.ok ? now : null,
      smsProviderRef: sms.providerRef ?? null,
      publicUrl,
      lastError: sms.ok ? null : "SMS_SEND_FAILED",
    };

    item.events = [
      { at: now, type: "session.created", meta: { incidentId, sessionId } },
      { at: now, type: "token.issued", meta: { tokenHashPrefix: tokenHash.slice(0, 8) } },
      {
        at: now,
        type: sms.ok ? "sms.requested" : "sms.logged",
        meta: { ok: sms.ok, logOnly: Boolean(sms.logOnly) },
      },
    ];

    await repo.put(item);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_SESSION_CREATED,
      details: { sessionId, tokenHashPrefix: tokenHash.slice(0, 8) },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });

    if (sms.ok) {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId: incident.agencyId,
        incidentId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_SMS_SENT,
        details: { sessionId, providerRef: sms.providerRef },
        createdAt: now,
        resourceType: "session",
        resourceId: sessionId,
      });
    }

    return { session: toDispatcher(item), token, publicUrl };
  }

  async getDispatcherSession(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    const item = await repo.get(sessionId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    return toDispatcher(item);
  }

  async listEvents(incidentId: string, sessionId: string, user: UserContext) {
    const session = await this.getDispatcherSession(incidentId, sessionId, user);
    return { events: session.events ?? [] };
  }

  async listSessionsBrief(incidentId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    const rows = await repo.listByIncident(incidentId, 25);
    return {
      items: rows.map((r) => ({
        sessionId: r.sessionId,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        smsSentAt: r.smsSentAt,
      })),
    };
  }

  async cancelSession(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    item = append(item, { at: now, type: "session.canceled", meta: { by: user.userId } });
    item = {
      ...item,
      status: "canceled",
      canceledAt: now,
      canceledBySub: user.userId,
      updatedAt: now,
    };
    await repo.put(item);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_SESSION_CANCELED,
      details: { sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
    return toDispatcher(item);
  }

  async resendSms(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    const item = await repo.get(sessionId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    assertLive(item);
    if (!item.publicUrl) throw new Error("MISSING_PUBLIC_URL");
    const sms = await sendVideoAssistSms({
      phoneE164: item.callerPhoneE164,
      message: `Rapid Cortex live video link (resend): ${item.publicUrl}`,
    });
    const now = new Date().toISOString();
    let next = append(item, {
      at: now,
      type: "sms.requested",
      meta: { resend: true, ok: sms.ok },
    });
    next = {
      ...next,
      smsSentAt: sms.ok ? now : next.smsSentAt,
      smsProviderRef: sms.providerRef ?? next.smsProviderRef,
      status: sms.ok ? "sms_sent" : next.status,
      updatedAt: now,
    };
    await repo.put(next);
    return toDispatcher(next);
  }

  async getPublicByToken(token: string): Promise<VideoAssistPublicSession> {
    assertConfigured();
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    if (Date.parse(item.expiresAt) < Date.now()) throw new Error("SESSION_EXPIRED");
    return toPublic(item);
  }

  async recordOpened(token: string): Promise<VideoAssistPublicSession> {
    assertConfigured();
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    assertLive(item);
    const now = new Date().toISOString();
    let next = append(item, { at: now, type: "link.opened" });
    next = {
      ...next,
      openedAt: next.openedAt ?? now,
      status: advanceStatus(next.status as VideoAssistSessionStatus, "opened"),
      updatedAt: now,
    };
    await repo.put(next);
    return toPublic(next);
  }

  async recordConsent(token: string, raw: unknown): Promise<VideoAssistPublicSession> {
    assertConfigured();
    const parsed = videoAssistConsentBodySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    assertLive(item);
    const now = new Date().toISOString();
    const body: VideoAssistConsentBody = parsed.data;
    let next = append(item, {
      at: now,
      type: "consent.recorded",
      meta: { client: body.client },
    });
    next = {
      ...next,
      consentAt: now,
      status: advanceStatus(next.status as VideoAssistSessionStatus, "consent_pending"),
      updatedAt: now,
    };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId: item.incidentId,
      actorId: "caller:consent",
      type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_CONSENT,
      details: { sessionId: item.sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: item.sessionId,
    });
    return toPublic(next);
  }

  async postCallerSignal(token: string, raw: unknown): Promise<VideoAssistPublicSession> {
    assertConfigured();
    const parsed = videoAssistSignalBodySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);
    const sig: VideoAssistSignalBody = parsed.data;
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    assertLive(item);
    const now = new Date().toISOString();
    let next = { ...item, updatedAt: now };
    if (sig.kind === "caller-offer") {
      next = append(next, { at: now, type: "signal.caller_offer", meta: {} });
      next = {
        ...next,
        callerOfferSdp: sig.sdp,
        status: advanceStatus(next.status as VideoAssistSessionStatus, "connecting"),
      };
    } else if (sig.kind === "ice-caller") {
      const ice = [...next.iceCaller, sig.candidate].slice(-40);
      next = append(next, { at: now, type: "ice.caller" });
      next = { ...next, iceCaller: ice };
    } else {
      throw new Error("FORBIDDEN_SIGNAL");
    }
    await repo.put(next);
    return toPublic(next);
  }

  async postDispatcherSignal(incidentId: string, sessionId: string, user: UserContext, raw: unknown) {
    assertConfigured();
    const parsed = videoAssistSignalBodySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);
    const sig: VideoAssistSignalBody = parsed.data;
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    assertLive(item);
    const now = new Date().toISOString();
    if (sig.kind === "dispatcher-answer") {
      item = append(item, { at: now, type: "signal.dispatcher_answer", meta: { by: user.userId } });
      item = {
        ...item,
        dispatcherAnswerSdp: sig.sdp,
        status: advanceStatus(item.status as VideoAssistSessionStatus, "connecting"),
        updatedAt: now,
      };
    } else if (sig.kind === "ice-dispatcher") {
      const ice = [...item.iceDispatcher, sig.candidate].slice(-40);
      item = append(item, { at: now, type: "ice.dispatcher", meta: { by: user.userId } });
      item = { ...item, iceDispatcher: ice, updatedAt: now };
    } else {
      throw new Error("FORBIDDEN_SIGNAL");
    }
    await repo.put(item);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_SIGNAL,
      details: { sessionId, kind: sig.kind },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
    return toDispatcher(item);
  }

  async endCaller(token: string): Promise<VideoAssistPublicSession> {
    assertConfigured();
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    let next = append(item, { at: now, type: "stream.ended", meta: { side: "caller" } });
    next = { ...next, endedAt: now, status: "ended", updatedAt: now };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId: item.incidentId,
      actorId: "caller:end",
      type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_STREAM_ENDED,
      details: { sessionId: item.sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: item.sessionId,
    });
    return toPublic(next);
  }

  async markLiveFromDispatcher(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    item = append(item, { at: now, type: "stream.started", meta: { by: user.userId } });
    item = {
      ...item,
      streamStartedAt: now,
      status: "live",
      updatedAt: now,
    };
    await repo.put(item);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.VIDEO_ASSIST_STREAM_STARTED,
      details: { sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
    return toDispatcher(item);
  }

  iceServers(): { iceServers: { urls: string | string[]; username?: string; credential?: string }[] } {
    const raw = process.env.VIDEO_ASSIST_ICE_SERVERS_JSON?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { urls: string | string[]; username?: string; credential?: string }[];
        if (Array.isArray(parsed)) return { iceServers: parsed };
      } catch {
        /* fall through */
      }
    }
    return { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  }
}

/** Monotonic-ish status refinement for happy-path milestones. */
function advanceStatus(
  current: VideoAssistSessionStatus,
  milestone: "opened" | "consent_pending" | "connecting",
): VideoAssistSessionStatus {
  if (current === "ended" || current === "canceled" || current === "failed") return current;
  if (milestone === "opened") return "opened";
  if (milestone === "consent_pending") return "consent_pending";
  return "connecting";
}
