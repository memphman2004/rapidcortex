import { randomBytes } from "node:crypto";
import {
  buildSelfServiceSmsBody,
  callerRequestedSmsLink,
  resolveSelfServiceLink,
  shouldOfferOnlineReportingSms,
  type CallAssistSmsSelfService,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { buildSmsFactoryEnvForAgency } from "../lib/smsFactoryEnv.js";
import { sendIncidentMediaLinkSms } from "../services/sms/smsProviderFactory.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore, type CallAssistSessionRecord, type CallAssistTenantConfig } from "./store.js";
import { fileCallAssistRms } from "./rms/rms-file.js";

const auditRepo = new AuditRepository();

function digitsPhone(raw?: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw?.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

export function portalUrlFromConfig(config: CallAssistTenantConfig): string {
  return (config.onlineReportUrl || config.carfaxPortalUrl || "").trim();
}

export function shouldOfferSessionSms(opts: {
  session: CallAssistSessionRecord;
  config: CallAssistTenantConfig;
  utterance: string;
}): boolean {
  if (opts.config.selfServiceSmsEnabled === false) return false;
  const eligible =
    Boolean(opts.session.triage?.onlineReportingEligible || opts.session.triage?.carfaxReportingEligible) ||
    callerRequestedSmsLink(opts.utterance);
  return shouldOfferOnlineReportingSms({
    onlineReportingEligible: eligible,
    portalUrl: portalUrlFromConfig(opts.config),
    alreadyOffered: Boolean(opts.session.smsSelfService),
    emergencyDetected: Boolean(opts.session.triage?.emergencyDetected),
  });
}

export async function sendSelfServiceSms(opts: {
  session: CallAssistSessionRecord;
  config: CallAssistTenantConfig;
  actorId: string;
  phoneE164?: string;
  nowIso: string;
}): Promise<CallAssistSessionRecord> {
  const portalUrl = portalUrlFromConfig(opts.config);
  if (!portalUrl) throw new Error("ONLINE_REPORT_URL_REQUIRED");
  const phone = digitsPhone(opts.phoneE164 || opts.session.intake.callbackNumber);
  if (!phone) throw new Error("SMS_PHONE_REQUIRED");
  const token = randomBytes(24).toString("hex");
  const publicBase =
    process.env.CALL_ASSIST_PUBLIC_BASE_URL?.trim() ||
    env.appPublicBaseUrl ||
    env.videoAssistPublicBaseUrl ||
    env.incidentMediaPublicBaseUrl;
  const resolved = resolveSelfServiceLink({ publicBaseUrl: publicBase, token, portalUrl });
  const body = buildSelfServiceSmsBody({
    agencyDisplayName: opts.config.agencyDisplayName || opts.config.agencyName || opts.config.agencyShortName || "This agency",
    link: resolved.link,
  });
  const smsEnv = await buildSmsFactoryEnvForAgency(opts.session.agencyId);
  const sent = await sendIncidentMediaLinkSms(smsEnv, {
    toPhoneE164: phone,
    messageBody: body,
    agencyId: opts.session.agencyId,
    incidentId: opts.session.sessionId,
    messageType: "call_assist_self_service",
  });
  const record: CallAssistSmsSelfService = {
    token,
    status: sent.status === "failed" ? "FAILED" : "SENT",
    portalUrl,
    sentAt: opts.nowIso,
    provider: sent.provider,
    messageId: sent.messageId,
    lastError: sent.errorMessage,
    phoneLast4: phone.slice(-4),
  };
  await callAssistStore.putSelfServiceToken({
    token,
    agencyId: opts.session.agencyId,
    sessionId: opts.session.sessionId,
    portalUrl,
    expiresAt: Math.floor(Date.now() / 1000) + 14 * 86_400,
  });
  opts.session.smsSelfService = record;
  opts.session.updatedAt = opts.nowIso;
  await callAssistStore.putSession(opts.session);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: opts.session.agencyId,
    actorId: opts.actorId,
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_SMS_SELF_SERVICE_SENT,
    details: { sessionId: opts.session.sessionId, status: record.status, tokenized: resolved.tokenized },
    createdAt: opts.nowIso,
    resourceType: "session",
    resourceId: opts.session.sessionId,
  });
  if (sent.status === "failed") throw new Error(sent.errorMessage || "SMS_SEND_FAILED");
  return opts.session;
}

export async function loadSelfServiceByToken(token: string): Promise<{
  session: CallAssistSessionRecord;
  portalUrl: string;
} | null> {
  const row = await callAssistStore.getSelfServiceToken(token);
  if (!row) return null;
  const session = await callAssistStore.getSession(row.agencyId, row.sessionId);
  if (!session || session.agencyId !== row.agencyId) return null;
  return { session, portalUrl: row.portalUrl || session.smsSelfService?.portalUrl || "" };
}

/** First GET of a sent SMS link marks the session as clicked. */
export async function markSelfServiceOpened(token: string): Promise<CallAssistSessionRecord | null> {
  const loaded = await loadSelfServiceByToken(token);
  if (!loaded?.session.smsSelfService) return loaded?.session ?? null;
  if (loaded.session.smsSelfService.status !== "SENT") return loaded.session;
  return completeSelfService({ token, disposition: "clicked" });
}

export async function completeSelfService(opts: {
  token: string;
  disposition: "clicked" | "completed" | "abandoned";
  notes?: string;
}): Promise<CallAssistSessionRecord> {
  const loaded = await loadSelfServiceByToken(opts.token);
  if (!loaded) throw new Error("SELF_SERVICE_TOKEN_INVALID");
  const nowIso = new Date().toISOString();
  const current = loaded.session.smsSelfService;
  if (!current) throw new Error("SELF_SERVICE_TOKEN_INVALID");
  const next: CallAssistSmsSelfService = {
    ...current,
    status: opts.disposition === "clicked" ? "CLICKED" : opts.disposition === "abandoned" ? "FAILED" : "COMPLETED",
    clickedAt: current.clickedAt ?? nowIso,
    completedAt: opts.disposition === "completed" ? nowIso : current.completedAt,
    lastError: opts.disposition === "abandoned" ? opts.notes : current.lastError,
  };
  loaded.session.smsSelfService = next;
  loaded.session.updatedAt = nowIso;
  if (opts.disposition === "completed") {
    loaded.session.state = "COMPLETED";
    loaded.session.completedAt = nowIso;
    loaded.session.continueAiConversation = false;
  }
  await callAssistStore.putSession(loaded.session);
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId: loaded.session.agencyId,
    actorId: "self-service",
    type: AUDIT_EVENT_TYPES.CALL_ASSIST_SMS_SELF_SERVICE_COMPLETED,
    details: { disposition: opts.disposition, sessionId: loaded.session.sessionId },
    createdAt: nowIso,
    resourceType: "session",
    resourceId: loaded.session.sessionId,
  });
  if (opts.disposition === "completed") {
    await fileCallAssistRms({
      session: loaded.session,
      actorId: "self-service",
      humanReviewApproved: true,
      source: "online_reporting",
    }).catch(() => undefined);
  }
  return loaded.session;
}
