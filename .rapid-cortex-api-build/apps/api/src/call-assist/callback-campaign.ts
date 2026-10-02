import {
  applyCallbackAttempt,
  callerAcceptedOffer,
  callerDeclinedOffer,
  normalizeCallbackSettings,
  shouldOfferCallback,
  type CallAssistCallbackCampaign,
  type CallAssistCallbackSettings,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore, type CallAssistSessionRecord, type CallAssistTenantConfig } from "./store.js";
import { AmazonConnectProvider } from "./telephony/amazon-connect.js";

const auditRepo = new AuditRepository();
const telephony = new AmazonConnectProvider();

function digitsPhone(raw?: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw?.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

export function callbackSettingsFromConfig(config: CallAssistTenantConfig): CallAssistCallbackSettings {
  return normalizeCallbackSettings(config.callback);
}

export function shouldOfferSessionCallback(opts: {
  config: CallAssistTenantConfig;
  session: CallAssistSessionRecord;
  hoursOpen: boolean;
  utterance: string;
}): boolean {
  return shouldOfferCallback({
    settings: callbackSettingsFromConfig(opts.config),
    hoursOpen: opts.hoursOpen,
    mode: opts.session.mode,
    utterance: opts.utterance,
    alreadyOffered: Boolean(opts.session.callback),
    emergencyDetected: Boolean(opts.session.triage?.emergencyDetected) || opts.session.state === "TRANSFERRING_911",
  });
}

export async function offerCallbackCampaign(opts: {
  session: CallAssistSessionRecord;
  config: CallAssistTenantConfig;
  actorId: string;
  phoneE164?: string;
  nowIso: string;
}): Promise<CallAssistSessionRecord> {
  const settings = callbackSettingsFromConfig(opts.config);
  const phone = digitsPhone(opts.phoneE164 || opts.session.intake.callbackNumber);
  const spoken = await telephony.offerCallback({
    spokenCallerScript:
      "If you prefer, we can schedule a callback instead of holding. Would you like us to call you back at this number?",
  });
  const campaign: CallAssistCallbackCampaign = {
    callbackId: opts.session.callback?.callbackId ?? makeId("cb"),
    sessionId: opts.session.sessionId,
    agencyId: opts.session.agencyId,
    status: "OFFERED",
    phoneE164: phone || "+10000000000",
    attempts: [],
    maxAttempts: settings.maxAttempts,
    retryMinutes: settings.retryMinutes,
    dueAt: opts.nowIso,
    offeredAt: opts.nowIso,
  };
  opts.session.callback = campaign;
  opts.session.state = "CALLBACK_OFFERED";
  opts.session.nextQuestion = spoken.spokenCallerScript;
  opts.session.updatedAt = opts.nowIso;
  await callAssistStore.putCallback(campaign);
  await callAssistStore.putSession(opts.session);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.session.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_CALLBACK_OFFERED,
    details: { sessionId: opts.session.sessionId, callbackId: campaign.callbackId, hasPhone: Boolean(phone) },
    createdAt: opts.nowIso,
    resourceType: "session",
    resourceId: opts.session.sessionId,
  });
  return opts.session;
}

export async function decideCallbackOffer(opts: {
  session: CallAssistSessionRecord;
  actorId: string;
  accept: boolean;
  nowIso: string;
}): Promise<CallAssistSessionRecord> {
  if (!opts.session.callback) throw new Error("CALLBACK_NOT_OFFERED");
  if (opts.accept) {
    const phone = digitsPhone(opts.session.callback.phoneE164 || opts.session.intake.callbackNumber);
    if (!phone) throw new Error("CALLBACK_PHONE_REQUIRED");
    const queued: CallAssistCallbackCampaign = {
      ...opts.session.callback,
      phoneE164: phone,
      status: "QUEUED",
      queuedAt: opts.nowIso,
      dueAt: opts.nowIso,
    };
    opts.session.callback = queued;
    opts.session.state = "CALLBACK_QUEUED";
    opts.session.continueAiConversation = false;
    opts.session.updatedAt = opts.nowIso;
    await callAssistStore.putCallback(queued);
    await callAssistStore.putSession(opts.session);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.session.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CALL_ASSIST_CALLBACK_QUEUED,
      details: { callbackId: queued.callbackId },
      createdAt: opts.nowIso,
      resourceType: "session",
      resourceId: opts.session.sessionId,
    });
    return opts.session;
  }
  const declined: CallAssistCallbackCampaign = {
    ...opts.session.callback,
    status: "DECLINED",
    failureReason: "caller_declined",
    completedAt: opts.nowIso,
  };
  opts.session.callback = declined;
  opts.session.state = "INTAKE";
  opts.session.continueAiConversation = true;
  opts.session.updatedAt = opts.nowIso;
  await callAssistStore.putCallback(declined);
  await callAssistStore.putSession(opts.session);
  return opts.session;
}

export async function takeoverCallback(opts: {
  session: CallAssistSessionRecord;
  actorId: string;
  nowIso: string;
}): Promise<CallAssistSessionRecord> {
  const prior = opts.session.callback;
  if (!prior) throw new Error("CALLBACK_NOT_OFFERED");
  const next = applyCallbackAttempt(
    prior,
    { attempt: prior.attempts.length + 1, at: opts.nowIso, result: "taken_over" },
    opts.nowIso,
  );
  next.takenOverBy = opts.actorId;
  opts.session.callback = next;
  opts.session.state = "TRANSFERRING_HUMAN";
  opts.session.dispatcherId = opts.actorId;
  opts.session.humanTakeover = true;
  opts.session.continueAiConversation = false;
  opts.session.updatedAt = opts.nowIso;
  await callAssistStore.putCallback(next);
  await callAssistStore.putSession(opts.session);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.session.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_CALLBACK_TAKEOVER,
    details: { callbackId: next.callbackId },
    createdAt: opts.nowIso,
    resourceType: "session",
    resourceId: opts.session.sessionId,
  });
  return opts.session;
}

export async function processDueCallbacksForAgency(agencyId: string, actorId = "system:callback-worker"): Promise<{
  processed: number;
  connected: number;
  failed: number;
}> {
  const nowIso = new Date().toISOString();
  const due = await callAssistStore.listDueCallbacks(agencyId, nowIso, 25);
  let processed = 0;
  let connected = 0;
  let failed = 0;
  for (const campaign of due) {
    const session = await callAssistStore.getSession(agencyId, campaign.sessionId);
    if (!session || session.agencyId !== agencyId) continue;
    const attemptNo = campaign.attempts.length + 1;
    session.state = "CALLBACK_IN_PROGRESS";
    const outbound = await telephony.startOutboundCallback({
      destinationNumber: campaign.phoneE164,
      sessionId: session.sessionId,
      demo: session.source === "DEMO" || env.callAssistConnectMock,
    });
    const result = outbound.ok ? ("connected" as const) : ("failed" as const);
    const next = applyCallbackAttempt(
      campaign,
      {
        attempt: attemptNo,
        at: nowIso,
        result,
        reason: outbound.reason,
        contactId: outbound.contactId,
      },
      nowIso,
    );
    session.callback = next;
    if (next.status === "IN_PROGRESS") {
      connected += 1;
      session.connectContactId = outbound.contactId ?? session.connectContactId;
    }
    if (next.status === "FAILED") {
      failed += 1;
      session.state = "FAILED";
      session.completedAt = nowIso;
    } else if (next.status === "QUEUED") {
      session.state = "CALLBACK_QUEUED";
    }
    session.updatedAt = nowIso;
    await callAssistStore.putCallback(next);
    await callAssistStore.putSession(session);
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId,
      actorId,
      type: AUDIT_EVENT_TYPES.CALL_ASSIST_CALLBACK_ATTEMPTED,
      details: { callbackId: next.callbackId, result, reason: outbound.reason, attempt: attemptNo },
      createdAt: nowIso,
      resourceType: "session",
      resourceId: session.sessionId,
    });
    processed += 1;
  }
  return { processed, connected, failed };
}

export async function processDueCallbacksAllAgencies(): Promise<{ agencies: number; processed: number }> {
  const configs = await callAssistStore.listTenantConfigs(200);
  let processed = 0;
  for (const cfg of configs) {
    const out = await processDueCallbacksForAgency(cfg.agencyId);
    processed += out.processed;
  }
  return { agencies: configs.length, processed };
}

export function interpretCallbackUtterance(session: CallAssistSessionRecord, text: string): "accept" | "decline" | null {
  if (session.state !== "CALLBACK_OFFERED" || !session.callback) return null;
  if (callerAcceptedOffer(text)) return "accept";
  if (callerDeclinedOffer(text)) return "decline";
  return null;
}
