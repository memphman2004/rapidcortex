import {
  defaultCallAssistRoutingRules,
  evaluateCallAssistRouting,
  formatCallAssistCaseNumber,
  formatConfirmationForSpeech,
  type CallAssistCallRecord,
  type CallAssistRoutingRule,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { buildSmsFactoryEnvForAgency } from "../lib/smsFactoryEnv.js";
import { sendIncidentMediaLinkSms } from "../services/sms/smsProviderFactory.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { callAssistStore, type CallAssistSessionRecord, type CallAssistTenantConfig } from "./store.js";

const auditRepo = new AuditRepository();

function digitsPhone(raw?: string): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw?.trim().startsWith("+") && digits.length >= 10) return `+${digits}`;
  return "";
}

export function generateCallAssistConfirmation(opts: {
  agencyId: string;
  config?: CallAssistTenantConfig | null;
  at?: Date;
}): string {
  return formatCallAssistCaseNumber({
    agencyId: opts.agencyId,
    confirmationPrefix: opts.config?.confirmationPrefix,
    timeZone: opts.config?.operatingHours?.timezone,
    at: opts.at,
  });
}

export function spokenClosingWithConfirmation(opts: {
  closingBase: string;
  confirmationNumber: string;
}): string {
  const spoken = formatConfirmationForSpeech(opts.confirmationNumber);
  if (opts.closingBase.includes(opts.confirmationNumber)) {
    return opts.closingBase.replaceAll(opts.confirmationNumber, spoken);
  }
  return `${opts.closingBase} Your report number is ${spoken}.`;
}

export async function sendConfirmationSms(opts: {
  agencyId: string;
  confirmationNumber: string;
  agencyDisplayName: string;
  phoneE164?: string;
  sessionId: string;
  actorId: string;
  emergencyEscalated: boolean;
  smsConfirmationEnabled?: boolean;
}): Promise<boolean> {
  if (opts.emergencyEscalated) return false;
  if (opts.smsConfirmationEnabled === false) return false;
  if (!env.enableCallAssistSmsConfirmation) return false;
  const phone = digitsPhone(opts.phoneE164);
  if (!phone) return false;
  const message =
    `Your ${opts.agencyDisplayName} non-emergency report has been received.\n` +
    `Confirmation: ${opts.confirmationNumber}\n` +
    `Reference this number if you call back with updates.`;
  const smsEnv = await buildSmsFactoryEnvForAgency(opts.agencyId);
  await sendIncidentMediaLinkSms(smsEnv, {
    toPhoneE164: phone,
    messageBody: message,
    agencyId: opts.agencyId,
    incidentId: opts.sessionId,
    messageType: "call_assist_confirmation",
  });
  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CALL_ASSIST_SMS_CONFIRMATION_SENT,
      details: { confirmationNumber: opts.confirmationNumber },
      createdAt: new Date().toISOString(),
      resourceType: "call_assist_session",
      resourceId: opts.sessionId,
    });
  } catch {
    /* non-fatal */
  }
  return true;
}

async function deliverWebhook(url: string, body: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    /* non-fatal */
  }
}

async function deliverNotifySms(
  agencyId: string,
  phones: string[],
  message: string,
  sessionId: string,
): Promise<void> {
  const smsEnv = await buildSmsFactoryEnvForAgency(agencyId);
  for (const raw of phones) {
    const to = digitsPhone(raw);
    if (!to) continue;
    try {
      await sendIncidentMediaLinkSms(smsEnv, {
        toPhoneE164: to,
        messageBody: message,
        agencyId,
        incidentId: sessionId,
        messageType: "call_assist_routing_alert",
      });
    } catch {
      /* continue */
    }
  }
}

export async function finalizeCallAssistIntake(opts: {
  agencyId: string;
  actorId: string;
  session: CallAssistSessionRecord;
  config: CallAssistTenantConfig;
  confirmationNumber?: string;
  emergencyEscalated?: boolean;
  /** SMS channel already replies with the confirmation text — skip the extra outbound SMS. */
  skipConfirmationSms?: boolean;
}): Promise<{
  session: CallAssistSessionRecord;
  callRecord: CallAssistCallRecord;
  confirmationNumber: string;
  departmentId: string;
}> {
  const now = new Date().toISOString();
  const confirmationNumber =
    opts.confirmationNumber?.trim() ||
    opts.session.caseNumber?.trim() ||
    generateCallAssistConfirmation({ agencyId: opts.agencyId, config: opts.config });

  const rules: CallAssistRoutingRule[] = opts.config.routingRules?.length
    ? opts.config.routingRules
    : defaultCallAssistRoutingRules(opts.agencyId);

  const incidentType =
    opts.session.intake.incidentTypeHint || opts.session.triage?.primaryClassification || undefined;

  const route = evaluateCallAssistRouting({
    agencyId: opts.agencyId,
    confirmationNumber,
    incidentType,
    district: opts.session.intake.zoneId || opts.session.intake.zoneName,
    zoneId: opts.session.intake.zoneId,
    dangerScore: opts.session.triage?.emergencyDetected ? 1 : 0,
    createdAt: opts.session.createdAt || now,
    rules,
  });

  const status = opts.emergencyEscalated ? "ESCALATED" : "ROUTED";
  const callRecord: CallAssistCallRecord = {
    confirmationNumber,
    agencyId: opts.agencyId,
    callId: opts.session.connectContactId,
    sessionId: opts.session.sessionId,
    callbackNumber: opts.session.intake.callbackNumber,
    incidentType,
    incidentLocation: opts.session.intake.locationText,
    district: opts.session.intake.zoneName || opts.session.intake.zoneId,
    department: route.departmentId,
    status,
    aiTranscript: opts.session.utterances?.map((u) => `${u.speaker}: ${u.text}`).join("\n"),
    emergencyFlag: Boolean(opts.emergencyEscalated || opts.session.triage?.emergencyDetected),
    routingLog: [
      {
        at: now,
        action: route.fallback ? "fallback_supervisor" : "routed",
        departmentId: route.departmentId,
        ruleId: route.ruleId,
      },
    ],
    matchedRuleId: route.ruleId,
    slaMinutes: route.destination.slaMinutes,
    deliveryMethods: [...route.deliveryMethods],
    createdAt: opts.session.createdAt || now,
    updatedAt: now,
  };

  await callAssistStore.putCallRecord(callRecord);

  const session: CallAssistSessionRecord = {
    ...opts.session,
    caseNumber: confirmationNumber,
    routing: {
      destinationType: "CALL_QUEUE",
      destinationId: route.departmentId,
      displayName: route.departmentId,
      transferType: "BLIND",
      spokenCallerScript: "",
      advisoryOnly: true as const,
    },
    updatedAt: now,
    completedAt: opts.session.completedAt ?? now,
    state: opts.emergencyEscalated ? "TRANSFERRING_911" : "COMPLETED",
  };
  await callAssistStore.putSession(session);

  const agencyName =
    opts.config.agencyName || opts.config.agencyShortName || opts.config.shortName || opts.agencyId;

  if (route.destination.deliveryMethods.includes("sms") && route.destination.notifyPhones?.length) {
    await deliverNotifySms(
      opts.agencyId,
      route.destination.notifyPhones,
      `Call Assist ${confirmationNumber} → ${route.departmentId}: ${incidentType ?? "intake"}`,
      session.sessionId,
    );
  }
  if (route.destination.deliveryMethods.includes("webhook") && route.destination.webhookUrl) {
    await deliverWebhook(route.destination.webhookUrl, { callRecord, route });
  }

  if (!opts.emergencyEscalated && !opts.skipConfirmationSms) {
    await sendConfirmationSms({
      agencyId: opts.agencyId,
      confirmationNumber,
      agencyDisplayName: agencyName,
      phoneE164: session.intake.callbackNumber,
      sessionId: session.sessionId,
      actorId: opts.actorId,
      emergencyEscalated: false,
      smsConfirmationEnabled: opts.config.smsConfirmationEnabled,
    });
  }

  try {
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CALL_ASSIST_CONFIRMATION_CREATED,
      details: { confirmationNumber },
      createdAt: now,
      resourceType: "call_assist_session",
      resourceId: session.sessionId,
    });
    await auditRepo.create({
      eventId: makeId("audit"),
      agencyId: opts.agencyId,
      actorId: opts.actorId,
      type: AUDIT_EVENT_TYPES.CALL_ASSIST_ROUTED,
      details: {
        confirmationNumber,
        departmentId: route.departmentId,
        ruleId: route.ruleId,
        fallback: route.fallback,
      },
      createdAt: now,
      resourceType: "call_assist_session",
      resourceId: session.sessionId,
    });
  } catch {
    /* non-fatal */
  }

  return { session, callRecord, confirmationNumber, departmentId: route.departmentId };
}
