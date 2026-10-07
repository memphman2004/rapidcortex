import type { SNSEvent } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { isCallAssistConfirmationNumber } from "rapid-cortex-shared";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { makeId } from "../../lib/ids.js";
import { getAgencyIdByDid, getLexTenantConfig, normalizeCallAssistDid } from "../lex/runtime-store.js";
import {
  COMPLIANCE_MESSAGES,
  OPTED_OUT_MESSAGE,
  SESSION_RESET_MESSAGE,
  SESSION_TIMEOUT_MESSAGE,
  SMS_COMPLIANCE_FOOTER,
  buildWelcomeMessage,
  classifyKeyword,
  isNeutralOpener,
  isSessionResetRequest,
} from "./compliance.js";
import { matchKeyword } from "./keyword-handler.js";
import { resetLexSession, sendToLex } from "./lex-sms-client.js";
import {
  SMS_EMERGENCY_MESSAGE,
  buildSmsConfirmation,
  extractConfirmationFromText,
  formatForSms,
} from "./message-formatter.js";
import {
  isNewCaller,
  isOptedOut,
  isSessionIdle,
  recordOptIn,
  recordOptOut,
  getSmsSession,
  touchSession,
} from "./session-store.js";
import { sendSmsSegments } from "./sms-sender.js";
import {
  buildMediaAcknowledgment,
  inferCategoryFromSceneLabels,
  processInboundMedia,
} from "./media-handler.js";
import { claimMediaForConfirmation } from "./media-store.js";
import {
  fromEnglishToCitizen,
  smsTranslateEnabled,
  toEnglishForLex,
  detectSmsLanguage,
} from "./translate.js";

const auditRepo = new AuditRepository();

function featureEnabled(name: string, defaultWhenUnset = true): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return defaultWhenUnset;
}

function parseInbound(event: SNSEvent): SmsInboundMessage | null {
  try {
    const record = event.Records?.[0];
    if (!record?.Sns?.Message) return null;
    return JSON.parse(record.Sns.Message) as SmsInboundMessage;
  } catch {
    console.error(JSON.stringify({ event: "sms_inbound_parse_failed" }));
    return null;
  }
}

function inboundMediaItems(inbound: SmsInboundMessage): MmsMediaItem[] {
  const items = inbound.mediaItems ?? inbound.media ?? [];
  return items.filter((item) => typeof item?.url === "string" && item.url.trim() && item.contentType);
}

function last4(phone: string): string {
  return phone.replace(/\D/g, "").slice(-4) || "****";
}

function smsMediaEnabled(): boolean {
  const v = process.env.ENABLE_CALL_ASSIST_SMS_MEDIA?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  return true;
}

async function reply(agencyId: string, phone: string, message: string, sessionId: string): Promise<void> {
  if (!message.trim()) return;
  await sendSmsSegments({
    agencyId,
    toPhoneE164: phone,
    message,
    sessionId,
    messageType: "call_assist_confirmation",
  });
}

function withComplianceFooter(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return SMS_COMPLIANCE_FOOTER;
  if (trimmed.includes("Reply STOP to unsubscribe")) return trimmed;
  return `${trimmed}\n\n${SMS_COMPLIANCE_FOOTER}`;
}

async function replyCitizen(
  agencyId: string,
  phone: string,
  englishMessage: string,
  sessionId: string,
  language: string,
): Promise<void> {
  const outbound =
    smsTranslateEnabled() && language && language !== "en"
      ? await fromEnglishToCitizen(englishMessage, language)
      : englishMessage;
  await reply(agencyId, phone, outbound, sessionId);
}

async function sendWelcome(
  agencyId: string,
  phone: string,
  sessionId: string,
  language: string,
): Promise<void> {
  const config = await getLexTenantConfig(agencyId).catch(() => null);
  const agencyName =
    config?.agencyName ||
    config?.agencyDisplayName ||
    config?.agencyShortName ||
    config?.shortName ||
    agencyId;
  const smsDid =
    config?.smsDID?.trim() || process.env.CALL_ASSIST_SMS_ORIGINATION_NUMBER?.trim() || "";
  const voiceCandidates = [config?.connectNonEmergencyDID, config?.testDID]
    .map((v) => v?.trim() || "")
    .filter(Boolean);
  const voiceDid = voiceCandidates.find((d) => d !== smsDid) || voiceCandidates[0] || "";
  const welcome = buildWelcomeMessage({ agencyDisplayName: agencyName, voiceDidE164: voiceDid });
  await replyCitizen(agencyId, phone, welcome, sessionId, language);
  await touchSession(agencyId, phone, undefined, { welcomeSent: true, language });
}

export async function handleInboundSmsEvent(event: SNSEvent): Promise<void> {
  if (!featureEnabled("ENABLE_CALL_ASSIST_SMS_CHANNEL")) return;

  const inbound = parseInbound(event);
  if (!inbound) return;

  const phone = normalizeCallAssistDid(inbound.originationNumber || inbound.originationPhoneNumber || "");
  const destination = normalizeCallAssistDid(
    inbound.destinationNumber || inbound.destinationPhoneNumber || "",
  );
  const body = inbound.messageBody?.trim() ?? "";
  const mediaItems = smsMediaEnabled() ? inboundMediaItems(inbound) : [];
  const hasMms = mediaItems.length > 0;
  if (!phone || (!body && !hasMms)) return;

  const didAgency = destination ? await getAgencyIdByDid(destination) : null;
  const agencyId =
    didAgency ||
    process.env.CALL_ASSIST_SMS_DEFAULT_AGENCY_ID?.trim() ||
    "unknown";
  const sessionId = `sms_${phone.replace(/\D/g, "").slice(-10)}`;
  const keyword = classifyKeyword(inbound.messageKeyword ?? body);

  console.info(
    JSON.stringify({
      event: "sms_inbound",
      phone: last4(phone),
      bodyLength: body.length,
      keyword,
      agencyId,
      hasMms,
      mediaCount: mediaItems.length,
      msgId: inbound.inboundMessageId,
    }),
  );

  const priorLang = (await getSmsSession(agencyId, phone))?.language?.trim() || "";
  const language = smsTranslateEnabled() ? await detectSmsLanguage(body, priorLang || null) : "en";
  const englishBody = await toEnglishForLex(body, language);

  if (keyword === "STOP") {
    await recordOptOut(agencyId, phone);
    await resetLexSession(sessionId);
    await reply(agencyId, phone, COMPLIANCE_MESSAGES.STOP, sessionId);
    return;
  }

  if (keyword === "START") {
    await recordOptIn(agencyId, phone);
    await replyCitizen(agencyId, phone, COMPLIANCE_MESSAGES.START, sessionId, language);
    return;
  }

  if (await isOptedOut(agencyId, phone)) {
    await replyCitizen(
      agencyId,
      phone,
      keyword === "HELP" ? COMPLIANCE_MESSAGES.HELP : OPTED_OUT_MESSAGE,
      sessionId,
      language,
    );
    return;
  }

  if (keyword === "HELP") {
    await replyCitizen(agencyId, phone, COMPLIANCE_MESSAGES.HELP, sessionId, language);
    await touchSession(agencyId, phone, undefined, { language });
    return;
  }

  const isNew = await isNewCaller(agencyId, phone);
  // Two-tier first contact: welcome only for explorers; substantive texts go straight to Lex.
  let appendComplianceFooter = false;
  if (isNew && !hasMms && (isNeutralOpener(body) || isNeutralOpener(englishBody))) {
    await sendWelcome(agencyId, phone, sessionId, language);
    return;
  }
  if (isNew) {
    appendComplianceFooter = true;
  }

  if (!isNew && (await isSessionIdle(agencyId, phone))) {
    await resetLexSession(sessionId);
    await replyCitizen(agencyId, phone, SESSION_TIMEOUT_MESSAGE, sessionId, language);
    await touchSession(agencyId, phone, undefined, { language });
    return;
  }

  if (isSessionResetRequest(body) || isSessionResetRequest(englishBody)) {
    await resetLexSession(sessionId);
    await replyCitizen(agencyId, phone, SESSION_RESET_MESSAGE, sessionId, language);
    await touchSession(agencyId, phone, undefined, { language });
    return;
  }

  // ── Keyword command check (before MMS / Lex) ────────────────────────────
  const keywordResponse =
    (await matchKeyword(body, agencyId)) || (await matchKeyword(englishBody, agencyId));
  if (keywordResponse) {
    const outbound = appendComplianceFooter ? withComplianceFooter(keywordResponse) : keywordResponse;
    await replyCitizen(agencyId, phone, outbound, sessionId, language);
    await touchSession(agencyId, phone, undefined, {
      language,
      ...(appendComplianceFooter ? { welcomeSent: true } : {}),
    });
    console.info(
      JSON.stringify({
        event: "sms_keyword_match",
        phone: last4(phone),
        keyword: body.trim().toUpperCase(),
        agencyId,
        language,
      }),
    );
    return;
  }

  let mediaRequestAttrs: Record<string, string> = {};
  let mediaCount = 0;
  let lexBody = englishBody;

  if (hasMms) {
    let mediaResult: Awaited<ReturnType<typeof processInboundMedia>> | null = null;
    try {
      mediaResult = await processInboundMedia(
        agencyId,
        phone,
        inbound.inboundMessageId || sessionId,
        mediaItems,
      );
    } catch (err: unknown) {
      console.error(
        JSON.stringify({
          event: "sms_media_process_error",
          name: err instanceof Error ? err.name : "Error",
        }),
      );
      await replyCitizen(
        agencyId,
        phone,
        "We had trouble receiving your media. You can still submit a report — just describe the issue.",
        sessionId,
        language,
      );
    }

    if (mediaResult) {
      const inferredCategory = inferCategoryFromSceneLabels(
        mediaResult.accepted.flatMap((m) => m.sceneLabels),
      );
      const ack = buildMediaAcknowledgment(mediaResult.accepted, mediaResult.rejected, inferredCategory);
      if (ack) await replyCitizen(agencyId, phone, ack, sessionId, language);
      mediaCount = mediaResult.accepted.length;
      if (mediaCount > 0) {
        mediaRequestAttrs = {
          "x-rc-media-count": String(mediaCount),
          ...(inferredCategory ? { "x-rc-inferred-category": inferredCategory } : {}),
        };
      }
      if (!lexBody && inferredCategory) {
        lexBody = `I am reporting a ${inferredCategory.toLowerCase().replace(/_/g, " ")}`;
      }
      if (!lexBody) {
        await touchSession(agencyId, phone, undefined, { language });
        return;
      }
    }
  }

  if (!lexBody) {
    await touchSession(agencyId, phone, undefined, { language });
    return;
  }

  let lexTurn;
  try {
    lexTurn = await sendToLex({
      sessionId,
      text: lexBody,
      sessionAttributes: {
        agencyId,
        callId: sessionId,
        channel: "sms",
        callbackNumber: phone,
        intakeStarted: "true",
        language,
        preferredLanguage: language,
      },
      requestAttributes: mediaRequestAttrs,
    });
  } catch (err: unknown) {
    const lexErr = err as { name?: string; message?: string };
    console.error(
      JSON.stringify({
        event: "lex_sms_error",
        name: lexErr?.name ?? (err instanceof Error ? err.name : "Error"),
        message: typeof lexErr?.message === "string" ? lexErr.message.slice(0, 400) : undefined,
      }),
    );
    const sorry =
      "Sorry, we encountered a problem. Please call this number or try again in a moment. For emergencies call 911.";
    await replyCitizen(
      agencyId,
      phone,
      appendComplianceFooter ? withComplianceFooter(sorry) : sorry,
      sessionId,
      language,
    );
    await touchSession(agencyId, phone, undefined, {
      language,
      ...(appendComplianceFooter ? { welcomeSent: true } : {}),
    });
    return;
  }

  const rawText = lexTurn.messages.map((m) => m.content).join(" ");
  const confirmation =
    (lexTurn.sessionAttributes.confirmationNumber || lexTurn.sessionAttributes.caseNumber || "").trim() ||
    extractConfirmationFromText(rawText);
  const validConfirmation =
    confirmation && isCallAssistConfirmationNumber(confirmation) ? confirmation : undefined;
  const emergency =
    lexTurn.sessionAttributes.emergency === "true" ||
    lexTurn.sessionAttributes.transferReason === "EMERGENCY" ||
    lexTurn.sessionAttributes.transferReason === "INJURY_PRIORITY";

  let outbound: string;

  if (emergency) {
    outbound = SMS_EMERGENCY_MESSAGE;
  } else if (validConfirmation) {
    const config = await getLexTenantConfig(agencyId).catch(() => null);
    const agencyName =
      config?.agencyName || config?.agencyShortName || config?.shortName || agencyId;
    outbound = buildSmsConfirmation({
      confirmationNumber: validConfirmation,
      agencyDisplayName: agencyName,
      department: lexTurn.sessionAttributes.departmentId,
      mediaCount,
    });
  } else {
    outbound = formatForSms(lexTurn.messages);
  }

  if (appendComplianceFooter && !emergency) {
    outbound = withComplianceFooter(outbound);
  }

  await replyCitizen(agencyId, phone, outbound, sessionId, language);
  await touchSession(agencyId, phone, validConfirmation, {
    language,
    ...(appendComplianceFooter ? { welcomeSent: true } : {}),
  });
  if (validConfirmation) {
    await claimMediaForConfirmation(agencyId, phone, validConfirmation).catch((err: unknown) => {
      console.error(
        JSON.stringify({
          event: "sms_media_claim_soft_fail",
          name: err instanceof Error ? err.name : "Error",
        }),
      );
    });
  }

  if (validConfirmation && !emergency) {
    try {
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: "system:call-assist-sms-channel",
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_SMS_CONFIRMATION_SENT,
        details: { confirmationNumber: validConfirmation, channel: "sms", language },
        createdAt: new Date().toISOString(),
        resourceType: "call_assist_session",
        resourceId: sessionId,
      });
    } catch {
      /* non-fatal */
    }
  }

  console.info(
    JSON.stringify({
      event: "sms_turn_complete",
      phone: last4(phone),
      intentName: lexTurn.intentName,
      intentState: lexTurn.intentState,
      sessionEnded: lexTurn.sessionEnded,
      confirmation: Boolean(validConfirmation),
      mediaAttached: mediaCount,
      language,
    }),
  );
}

export const handler = async (event: SNSEvent): Promise<void> => {
  await handleInboundSmsEvent(event);
};
