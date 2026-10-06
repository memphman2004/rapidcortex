import type { SNSEvent } from "aws-lambda";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { isCallAssistConfirmationNumber } from "rapid-cortex-shared";
import { AuditRepository } from "../../repositories/auditRepository.js";
import { makeId } from "../../lib/ids.js";
import { getAgencyIdByDid, getLexTenantConfig, normalizeCallAssistDid } from "../lex/runtime-store.js";
import {
  COMPLIANCE_MESSAGES,
  OPTED_OUT_MESSAGE,
  SESSION_TIMEOUT_MESSAGE,
  buildWelcomeMessage,
  classifyKeyword,
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
  needsWelcome,
  recordOptIn,
  recordOptOut,
  touchSession,
} from "./session-store.js";
import { sendSmsSegments } from "./sms-sender.js";
import {
  buildMediaAcknowledgment,
  inferCategoryFromSceneLabels,
  processInboundMedia,
} from "./media-handler.js";
import { claimMediaForConfirmation } from "./media-store.js";
import type { MmsMediaItem, SmsInboundMessage } from "./types.js";

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

async function sendWelcome(agencyId: string, phone: string, sessionId: string): Promise<void> {
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
  await reply(
    agencyId,
    phone,
    buildWelcomeMessage({ agencyDisplayName: agencyName, voiceDidE164: voiceDid }),
    sessionId,
  );
  await touchSession(agencyId, phone, undefined, { welcomeSent: true });
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

  if (keyword === "STOP") {
    await recordOptOut(agencyId, phone);
    await resetLexSession(sessionId);
    await reply(agencyId, phone, COMPLIANCE_MESSAGES.STOP, sessionId);
    return;
  }

  if (keyword === "START") {
    await recordOptIn(agencyId, phone);
    await reply(agencyId, phone, COMPLIANCE_MESSAGES.START, sessionId);
    return;
  }

  if (await isOptedOut(agencyId, phone)) {
    await reply(
      agencyId,
      phone,
      keyword === "HELP" ? COMPLIANCE_MESSAGES.HELP : OPTED_OUT_MESSAGE,
      sessionId,
    );
    return;
  }

  if (keyword === "HELP") {
    await reply(agencyId, phone, COMPLIANCE_MESSAGES.HELP, sessionId);
    await touchSession(agencyId, phone);
    return;
  }

  const isNew = await isNewCaller(agencyId, phone);
  const normalizedBody = body.trim().toUpperCase();
  const isGreetingOnly = ["HI", "HELLO", "HEY"].includes(normalizedBody);
  const shouldSendWelcome = isGreetingOnly || (await needsWelcome(agencyId, phone));

  // First outbound to this phone (or HI/HELLO): welcome only — never Lex on this turn.
  // Customer can restate their issue (or keyword) on the next text.
  if (shouldSendWelcome) {
    await sendWelcome(agencyId, phone, sessionId);
    return;
  }

  if (isNew) {
    await touchSession(agencyId, phone);
  }

  if (!isNew && (await isSessionIdle(agencyId, phone))) {
    await resetLexSession(sessionId);
    await reply(agencyId, phone, SESSION_TIMEOUT_MESSAGE, sessionId);
    await touchSession(agencyId, phone);
    return;
  }

  if (isSessionResetRequest(body)) {
    await resetLexSession(sessionId);
    await sendWelcome(agencyId, phone, sessionId);
    return;
  }

  // ── Keyword command check (before MMS / Lex) ────────────────────────────
  const keywordResponse = await matchKeyword(body, agencyId);
  if (keywordResponse) {
    await reply(agencyId, phone, keywordResponse, sessionId);
    await touchSession(agencyId, phone);
    console.info(
      JSON.stringify({
        event: "sms_keyword_match",
        phone: last4(phone),
        keyword: body.trim().toUpperCase(),
        agencyId,
      }),
    );
    return;
  }

  let mediaRequestAttrs: Record<string, string> = {};
  let mediaCount = 0;
  let lexBody = body;

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
      await reply(
        agencyId,
        phone,
        "We had trouble receiving your media. You can still submit a report — just describe the issue.",
        sessionId,
      );
    }

    if (mediaResult) {
      const inferredCategory = inferCategoryFromSceneLabels(
        mediaResult.accepted.flatMap((m) => m.sceneLabels),
      );
      const ack = buildMediaAcknowledgment(mediaResult.accepted, mediaResult.rejected, inferredCategory);
      if (ack) await reply(agencyId, phone, ack, sessionId);
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
        await touchSession(agencyId, phone);
        return;
      }
    }
  }

  if (!lexBody) {
    await touchSession(agencyId, phone);
    return;
  }

  let lexTurn;
  try {
    lexTurn = await sendToLex({
      // Lex sessionId allows [0-9a-zA-Z._:-] only — never pass E.164 with '+'.
      sessionId,
      text: lexBody,
      sessionAttributes: {
        agencyId,
        callId: sessionId,
        channel: "sms",
        callbackNumber: phone,
        // Skip voice IVR greeting injection in the dialog hook.
        intakeStarted: "true",
      },
      requestAttributes: mediaRequestAttrs,
    });
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "lex_sms_error",
        name: err instanceof Error ? err.name : "Error",
      }),
    );
    await reply(
      agencyId,
      phone,
      "Sorry, we encountered a problem. Please call this number or try again in a moment. For emergencies call 911.",
      sessionId,
    );
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

  await reply(agencyId, phone, outbound, sessionId);
  await touchSession(agencyId, phone, validConfirmation);
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
        details: { confirmationNumber: validConfirmation, channel: "sms" },
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
    }),
  );
}

export const handler = async (event: SNSEvent): Promise<void> => {
  await handleInboundSmsEvent(event);
};
