import { createHash, randomBytes } from "node:crypto";
import type {
  CreateSilentTextSessionBody,
  PostSilentTextMessageBody,
  SilentTextDispatcherSession,
  SilentTextMessage,
  SilentTextPublicSession,
  SilentTextSessionEvent,
  SilentTextSessionStatus,
  TranscriptSegment,
  UserContext,
} from "rapid-cortex-shared";
import {
  createSilentTextSessionBodySchema,
  postSilentTextMessageBodySchema,
  silentTextPresenceBodySchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES, TenantAccessGuard } from "rapid-cortex-security";
import { toTranslatePrimaryTag } from "rapid-cortex-shared";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { sendSilentTextSms } from "../lib/silentTextSms.js";
import { getMultilingualVoiceConfig } from "../voice/multilingualConfig.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { IncidentRepository } from "../repositories/incidentRepository.js";
import type { SilentTextDdbItem } from "../repositories/silentTextRepository.js";
import { SilentTextRepository } from "../repositories/silentTextRepository.js";
import { TranscriptRepository } from "../repositories/transcriptRepository.js";
import {
  synthesizeTextWithConfiguredProvider,
  translateFromEnglish,
  translateToEnglish,
} from "./language/languageProviderFactory.js";

const repo = new SilentTextRepository();
const auditRepo = new AuditRepository();
const incidentRepo = new IncidentRepository();
const transcriptRepo = new TranscriptRepository();

const MAX_MESSAGES = 220;
const MAX_EVENTS = 120;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function trimMessages(messages: SilentTextMessage[]): SilentTextMessage[] {
  if (messages.length <= MAX_MESSAGES) return messages;
  return messages.slice(-MAX_MESSAGES);
}

function trimEvents(events: SilentTextSessionEvent[]): SilentTextSessionEvent[] {
  if (events.length <= MAX_EVENTS) return events;
  return events.slice(-MAX_EVENTS);
}

function append(item: SilentTextDdbItem, ev: SilentTextSessionEvent): SilentTextDdbItem {
  const events = trimEvents([...item.events, ev]);
  return { ...item, events, updatedAt: new Date().toISOString() };
}

function inactiveAfterMs(): number {
  const n = Number.parseInt(process.env.SILENT_TEXT_INACTIVE_AFTER_MINUTES ?? "25", 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n * 60_000;
}

function maybeMarkInactive(item: SilentTextDdbItem): SilentTextDdbItem {
  const windowMs = inactiveAfterMs();
  if (!windowMs) return item;
  if (item.endedAt || item.canceledAt) return item;
  if (item.status !== "opened" && item.status !== "active") return item;
  const idle = Date.now() - Date.parse(item.lastActivityAt);
  if (idle < windowMs) return item;
  const now = new Date().toISOString();
  return {
    ...append(item, { at: now, type: "session.inactive_timeout", meta: {} }),
    status: "inactive",
    updatedAt: now,
  };
}

function toPublic(item: SilentTextDdbItem, messageCap = 120): SilentTextPublicSession {
  const messages = trimMessages(item.messages).slice(-messageCap);
  return {
    sessionId: item.sessionId,
    incidentId: item.incidentId,
    status: item.status as SilentTextPublicSession["status"],
    expiresAt: item.expiresAt,
    callerLocale: item.callerLocale,
    stealthAppearance: item.stealthAppearance,
    highRisk: item.highRisk,
    lastActivityAt: item.lastActivityAt,
    lastCallerPresenceAt: item.lastCallerPresenceAt ?? null,
    lastDispatcherPresenceAt: item.lastDispatcherPresenceAt ?? null,
    messages,
  };
}

function toDispatcher(item: SilentTextDdbItem): SilentTextDispatcherSession {
  return {
    ...toPublic(item, 200),
    agencyId: item.agencyId,
    callerPhoneE164: item.callerPhoneE164,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    smsSentAt: item.smsSentAt ?? null,
    openedAt: item.openedAt ?? null,
    endedAt: item.endedAt ?? null,
    canceledAt: item.canceledAt ?? null,
    closedBySub: item.closedBySub ?? null,
    lastError: item.lastError ?? null,
    events: item.events,
  };
}

/**
 * Fills `translatedForDispatcher` / `translatedForCaller` (and optional `ttsObjectKey` for stored audio) when
 * `SILENT_TEXT_TRANSLATION_ENABLED` and the text backend are configured. Dispatcher outbound copy is treated as English.
 */
async function enrichSilentTextMessage(
  item: SilentTextDdbItem,
  message: SilentTextMessage,
  side: "caller" | "dispatcher",
): Promise<SilentTextMessage> {
  const cfg = getMultilingualVoiceConfig();
  if (!cfg.silentTextTranslationEnabled) return message;
  const body = message.body?.trim() ?? "";
  if (!body) return message;
  const locale = item.callerLocale ?? "en";
  const loc = toTranslatePrimaryTag(locale);
  if (loc === "en" || loc === "und") return message;
  try {
    if (side === "caller") {
      const tr = await translateToEnglish(message.body, locale);
      return { ...message, translatedForDispatcher: tr.text };
    }
    const tr = await translateFromEnglish(message.body, locale);
    let out: SilentTextMessage = { ...message, translatedForCaller: tr.text };
    if (cfg.silentTextTtsEnabled) {
      try {
        const ut = await synthesizeTextWithConfiguredProvider(
          { text: tr.text, languageBcp: locale, preferredGender: "FEMALE" },
          { agencyId: item.agencyId, sessionId: item.sessionId, messageId: message.messageId },
        );
        if (ut.storageObjectKey) out = { ...out, ttsObjectKey: ut.storageObjectKey };
      } catch (e) {
        console.error("[silent-text] TTS failed", e);
      }
    }
    return out;
  } catch (e) {
    console.error("[silent-text] translation enrichment failed", e);
  }
  return message;
}

function assertConfigured(): void {
  if (!env.silentTextTable) throw new Error("SILENT_TEXT_TABLE_NOT_CONFIGURED");
}

function assertLive(item: SilentTextDdbItem): void {
  const now = Date.now();
  if (Date.parse(item.expiresAt) < now) throw new Error("SESSION_EXPIRED");
  if (item.canceledAt) throw new Error("SESSION_CANCELED");
  if (item.endedAt) throw new Error("SESSION_ENDED");
}

async function persistMaybeInactive(item: SilentTextDdbItem): Promise<SilentTextDdbItem> {
  const next = maybeMarkInactive(item);
  if (next !== item) {
    await repo.put(next);
    return next;
  }
  return item;
}

export class SilentTextService {
  async createSession(incidentId: string, user: UserContext, rawBody: unknown) {
    assertConfigured();
    const parsed = createSilentTextSessionBodySchema.safeParse(rawBody);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);

    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);

    const body: CreateSilentTextSessionBody = parsed.data;
    const sessionId = makeId("sts");
    const token = newOpaqueToken();
    const tokenHash = hashToken(token);
    const now = new Date().toISOString();
    const ttlMin = body.ttlMinutes ?? 120;
    const expiresAt = new Date(Date.now() + ttlMin * 60_000).toISOString();

    const base =
      body.publicAppBaseUrl?.replace(/\/$/, "") ||
      env.silentTextPublicBaseUrl?.replace(/\/$/, "") ||
      env.videoAssistPublicBaseUrl?.replace(/\/$/, "") ||
      "";
    if (!base) throw new Error("MISSING_PUBLIC_BASE_URL");

    const path = `/silent-text/${encodeURIComponent(token)}`;
    const publicUrl = `${base}${path}`;

    const msg = `Rapid Cortex secure message from emergency services: If it is not safe to speak, use this secure link to continue by text: ${publicUrl}`;

    const sms = await sendSilentTextSms({
      phoneE164: body.callerPhoneE164,
      message: msg,
      agencyId: incident.agencyId,
      incidentId,
    });

    const item: SilentTextDdbItem = {
      sessionId,
      tokenHash,
      agencyId: incident.agencyId,
      incidentId,
      status: sms.ok ? "sms_sent" : "failed",
      callerPhoneE164: body.callerPhoneE164,
      expiresAt,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      callerLocale: body.callerLocale,
      stealthAppearance: Boolean(body.stealthAppearance),
      highRisk: Boolean(body.highRisk),
      messages: [],
      events: [],
      smsSentAt: sms.ok ? now : null,
      smsProviderRef: sms.providerRef ?? null,
      publicUrl,
      lastError: sms.ok ? null : sms.errorCode ?? "SMS_SEND_FAILED",
    };

    item.events = [
      { at: now, type: "session.created", meta: { incidentId, sessionId, highRisk: item.highRisk } },
      { at: now, type: "token.issued", meta: { tokenHashPrefix: tokenHash.slice(0, 8) } },
      {
        at: now,
        type: "sms.requested",
        meta: {
          ok: sms.ok,
          provider: sms.provider,
          errorCode: sms.ok ? undefined : sms.errorCode,
        },
      },
    ];

    await repo.put(item);

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_SESSION_CREATED,
      details: { sessionId, tokenHashPrefix: tokenHash.slice(0, 8), highRisk: item.highRisk },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });

    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: sms.ok
        ? AUDIT_EVENT_TYPES.SILENT_TEXT_SMS_SENT
        : AUDIT_EVENT_TYPES.SILENT_TEXT_SMS_FAILED,
      details: {
        sessionId,
        provider: sms.provider,
        providerRef: sms.providerRef,
        errorCode: sms.ok ? undefined : sms.errorCode,
      },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });

    return { session: toDispatcher(item), token, publicUrl };
  }

  async getDispatcherSession(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId, incident.agencyId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    item = await persistMaybeInactive(item);
    return toDispatcher(item);
  }

  async listEvents(incidentId: string, sessionId: string, user: UserContext) {
    const session = await this.getDispatcherSession(incidentId, sessionId, user);
    return { events: session.events ?? [] };
  }

  async listSessionsBrief(incidentId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    const rows = await repo.listByIncident(incidentId, incident.agencyId, 25);
    return {
      items: rows.map((r) => ({
        sessionId: r.sessionId,
        status: r.status,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        smsSentAt: r.smsSentAt,
        highRisk: r.highRisk,
      })),
    };
  }

  async listMessages(incidentId: string, sessionId: string, user: UserContext) {
    const s = await this.getDispatcherSession(incidentId, sessionId, user);
    return { messages: s.messages };
  }

  async cancelSession(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId, incident.agencyId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    item = append(item, { at: now, type: "session.canceled", meta: { by: user.userId } });
    item = {
      ...item,
      status: "canceled",
      canceledAt: now,
      closedBySub: user.userId,
      updatedAt: now,
    };
    await repo.put(item);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_SESSION_CANCELED,
      details: { sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
    return toDispatcher(item);
  }

  async closeSession(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId, incident.agencyId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    item = append(item, { at: now, type: "session.closed", meta: { by: user.userId } });
    item = {
      ...item,
      status: "ended",
      endedAt: now,
      closedBySub: user.userId,
      updatedAt: now,
    };
    await repo.put(item);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_SESSION_CLOSED,
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
    const item = await repo.get(sessionId, incident.agencyId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    assertLive(item);
    if (!item.publicUrl) throw new Error("MISSING_PUBLIC_URL");
    const sms = await sendSilentTextSms({
      phoneE164: item.callerPhoneE164,
      message: `Rapid Cortex secure text link (resend): ${item.publicUrl}`,
      agencyId: incident.agencyId,
      incidentId,
    });
    const now = new Date().toISOString();
    let next = append(item, {
      at: now,
      type: "sms.requested",
      meta: {
        resend: true,
        ok: sms.ok,
        provider: sms.provider,
        errorCode: sms.ok ? undefined : sms.errorCode,
      },
    });
    next = {
      ...next,
      smsSentAt: sms.ok ? now : next.smsSentAt,
      smsProviderRef: sms.providerRef ?? next.smsProviderRef,
      status: sms.ok ? "sms_sent" : next.status,
      lastActivityAt: now,
      updatedAt: now,
      lastError: sms.ok ? next.lastError : sms.errorCode ?? next.lastError,
    };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: incident.agencyId,
      incidentId,
      actorId: user.userId,
      type: sms.ok
        ? AUDIT_EVENT_TYPES.SILENT_TEXT_SMS_RESENT
        : AUDIT_EVENT_TYPES.SILENT_TEXT_SMS_FAILED,
      details: {
        sessionId,
        provider: sms.provider,
        providerRef: sms.providerRef,
        errorCode: sms.ok ? undefined : sms.errorCode,
      },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
    return toDispatcher(next);
  }

  async markHighRisk(incidentId: string, sessionId: string, user: UserContext) {
    assertConfigured();
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId, incident.agencyId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    assertLive(item);
    const now = new Date().toISOString();
    item = append(item, { at: now, type: "session.marked_high_risk", meta: { by: user.userId } });
    item = { ...item, highRisk: true, updatedAt: now, lastActivityAt: now };
    await repo.put(item);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_HIGH_RISK,
      details: { sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
    return toDispatcher(item);
  }

  async postDispatcherMessage(incidentId: string, sessionId: string, user: UserContext, raw: unknown) {
    assertConfigured();
    const parsed = postSilentTextMessageBodySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);
    const body: PostSilentTextMessageBody = parsed.data;
    const incident = TenantAccessGuard.assertIncidentAccess(await incidentRepo.get(incidentId), user);
    let item = await repo.get(sessionId, incident.agencyId);
    if (!item || item.incidentId !== incidentId) throw new Error("NOT_FOUND");
    assertLive(item);
    item = await persistMaybeInactive(item);
    if (item.endedAt || item.canceledAt) throw new Error("SESSION_ENDED");

    const now = new Date().toISOString();
    let message: SilentTextMessage = {
      messageId: makeId("stm"),
      at: now,
      from: "dispatcher",
      body: body.text.trim(),
      promptTemplateId: body.promptTemplateId,
    };
    message = await enrichSilentTextMessage(item, message, "dispatcher");
    const messages = trimMessages([...item.messages, message]);
    let next = append(item, {
      at: now,
      type: "message.dispatcher",
      meta: { messageId: message.messageId, len: message.body.length },
    });
    next = {
      ...next,
      messages,
      lastActivityAt: now,
      lastDispatcherPresenceAt: now,
      updatedAt: now,
      status: advanceToActive(item.status as SilentTextSessionStatus),
    };
    await repo.put(next);
    await this.appendTranscriptMirror(next, message, user.userId);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId,
      actorId: user.userId,
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_MESSAGE,
      details: { sessionId, side: "dispatcher", messageId: message.messageId },
      createdAt: now,
      resourceType: "session",
      resourceId: sessionId,
    });
    return toDispatcher(next);
  }

  private async appendTranscriptMirror(item: SilentTextDdbItem, message: SilentTextMessage, _actorHint: string) {
    const seg: TranscriptSegment = {
      segmentId: makeId("seg"),
      incidentId: item.incidentId,
      agencyId: item.agencyId,
      speaker: message.from === "caller" ? "caller" : "dispatcher",
      text: `[Silent text · ${item.sessionId}] ${message.body}`,
      timestamp: message.at,
    };
    try {
      await transcriptRepo.add(seg);
    } catch (e) {
      console.error("[silent-text] transcript mirror failed", e);
    }
  }

  async getPublicByToken(token: string): Promise<SilentTextPublicSession> {
    assertConfigured();
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    if (Date.parse(item.expiresAt) < Date.now()) throw new Error("SESSION_EXPIRED");
    const next = await persistMaybeInactive(item);
    return toPublic(next, 150);
  }

  async recordOpened(token: string): Promise<SilentTextPublicSession> {
    assertConfigured();
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    assertLive(item);
    const now = new Date().toISOString();
    let next = append(item, { at: now, type: "link.opened" });
    next = {
      ...next,
      openedAt: next.openedAt ?? now,
      status: refineStatus(next.status as SilentTextSessionStatus, "opened"),
      lastActivityAt: now,
      lastCallerPresenceAt: now,
      updatedAt: now,
    };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId: item.incidentId,
      actorId: "caller:open",
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_OPENED,
      details: { sessionId: item.sessionId },
      createdAt: now,
      resourceType: "session",
      resourceId: item.sessionId,
    });
    return toPublic(next, 150);
  }

  async recordPresence(token: string, raw: unknown): Promise<SilentTextPublicSession> {
    assertConfigured();
    const parsed = silentTextPresenceBodySchema.safeParse(raw ?? {});
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    assertLive(item);
    const now = new Date().toISOString();
    let next = append(item, { at: now, type: "presence.caller", meta: parsed.data });
    next = {
      ...next,
      lastCallerPresenceAt: now,
      lastActivityAt: now,
      updatedAt: now,
    };
    await repo.put(next);
    return toPublic(next, 150);
  }

  async postCallerMessage(token: string, raw: unknown): Promise<SilentTextPublicSession> {
    assertConfigured();
    const parsed = postSilentTextMessageBodySchema.safeParse(raw);
    if (!parsed.success) throw new Error(`VALIDATION:${parsed.error.message}`);
    const body: PostSilentTextMessageBody = parsed.data;
    let item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    assertLive(item);
    item = await persistMaybeInactive(item);
    if (item.endedAt || item.canceledAt) throw new Error("SESSION_ENDED");

    const now = new Date().toISOString();
    let message: SilentTextMessage = {
      messageId: makeId("stm"),
      at: now,
      from: "caller",
      body: body.text.trim(),
    };
    message = await enrichSilentTextMessage(item, message, "caller");
    const messages = trimMessages([...item.messages, message]);
    let next = append(item, {
      at: now,
      type: "message.caller",
      meta: { messageId: message.messageId, len: message.body.length },
    });
    next = {
      ...next,
      messages,
      lastActivityAt: now,
      lastCallerPresenceAt: now,
      updatedAt: now,
      status: advanceToActive(item.status as SilentTextSessionStatus),
    };
    await repo.put(next);
    await this.appendTranscriptMirror(next, message, "caller:sms");
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId: item.incidentId,
      actorId: "caller:message",
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_MESSAGE,
      details: { sessionId: item.sessionId, side: "caller", messageId: message.messageId },
      createdAt: now,
      resourceType: "session",
      resourceId: item.sessionId,
    });
    return toPublic(next, 150);
  }

  async endCaller(token: string): Promise<SilentTextPublicSession> {
    assertConfigured();
    const item = await repo.getByTokenHash(hashToken(token));
    if (!item) throw new Error("NOT_FOUND");
    if (item.endedAt || item.canceledAt) return toPublic(item, 150);
    const now = new Date().toISOString();
    let next = append(item, { at: now, type: "session.ended_by_caller", meta: {} });
    next = { ...next, endedAt: now, status: "ended", updatedAt: now };
    await repo.put(next);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: item.agencyId,
      incidentId: item.incidentId,
      actorId: "caller:end",
      type: AUDIT_EVENT_TYPES.SILENT_TEXT_SESSION_CLOSED,
      details: { sessionId: item.sessionId, via: "caller" },
      createdAt: now,
      resourceType: "session",
      resourceId: item.sessionId,
    });
    return toPublic(next, 150);
  }

  async getPublicMessages(token: string): Promise<{ messages: SilentTextMessage[] }> {
    const s = await this.getPublicByToken(token);
    return { messages: s.messages };
  }
}

function refineStatus(current: SilentTextSessionStatus, milestone: "opened"): SilentTextSessionStatus {
  if (current === "ended" || current === "canceled" || current === "failed") return current;
  if (milestone === "opened") return "opened";
  return current;
}

function advanceToActive(current: SilentTextSessionStatus): SilentTextSessionStatus {
  if (current === "ended" || current === "canceled" || current === "failed") return current;
  if (current === "inactive") return "active";
  if (current === "opened" || current === "sms_sent" || current === "delivered" || current === "pending_send") {
    return "active";
  }
  return current;
}
