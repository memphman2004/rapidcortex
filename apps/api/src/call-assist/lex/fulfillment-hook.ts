import {
  assertGroundedReply,
  mergeIntakeFromLexSlots,
  municipalAfterHoursNote,
  topKnowledgeHit,
  type KnowledgeArticleLike,
} from "rapid-cortex-shared";
import type { CallAssistSessionRecord } from "../store.js";
import { mergeDashboardUtterances, utterancesFromLexTranscript } from "./lex-transcript.js";
import { getLexSession, getLexTenantConfig, listLexKnowledge, putLexSession } from "./runtime-store.js";
import { buildCadPayload } from "./cad-payload-builder.js";
import { agencyShortName, closingPrompt, transferPrompt } from "./prompts.js";
import { extractCurrentSlots } from "./slot-extractor.js";
import {
  accidentInjuriesYes,
  EMERGENCY_INTENT,
  FALLBACK_INTENT,
  PUBLIC_WORKS_INTENT,
  REPEAT_CALL_INTENT,
  REQUEST_HUMAN_INTENT,
  WELCOME_INTENT,
  weaponVisibleYes,
  type TransferReason,
} from "./dialog-intercept.js";
import { readCityService } from "./city-service.js";
import { closeTransferResponse, elicitIntentResponse, plain, speakForEngine } from "./lex-responses.js";
import { buildTransferSummary } from "./safety-gate.js";
import type { LexV2Event, LexV2Response } from "./types.js";
import { escalationCloseParts, handleSessionStart } from "./session-start.js";
import { smsClosingForIntent } from "../sms-channel/sms-copy.js";
import {
  finalizeCallAssistIntake,
  generateCallAssistConfirmation,
  spokenClosingWithConfirmation,
} from "../finalize-intake.js";

export type FulfillmentAction =
  | { type: "emergency"; reason: Extract<TransferReason, "EMERGENCY" | "INJURY_PRIORITY"> }
  | { type: "human"; intentName: string; reason: TransferReason }
  | { type: "complete" };

/** Intercept before Dynamo write so Lex cannot continue slot collection after a weapon/injury yes. */
export function resolveFulfillmentAction(
  event: LexV2Event,
  opts?: { surgeMode?: boolean },
): FulfillmentAction {
  const intent = event.sessionState.intent.name;
  const slots = event.sessionState.intent.slots ?? {};
  if (intent === EMERGENCY_INTENT || weaponVisibleYes(slots)) {
    return { type: "emergency", reason: "EMERGENCY" };
  }
  if (accidentInjuriesYes(slots)) {
    return { type: "emergency", reason: "INJURY_PRIORITY" };
  }
  if (intent === REQUEST_HUMAN_INTENT) {
    return { type: "human", intentName: REQUEST_HUMAN_INTENT, reason: "HUMAN_REQUEST" };
  }
  if (intent === REPEAT_CALL_INTENT) {
    return { type: "human", intentName: REPEAT_CALL_INTENT, reason: "REPEAT_CALL" };
  }
  if (intent === FALLBACK_INTENT) {
    if (opts?.surgeMode === true) return { type: "complete" };
    return { type: "human", intentName: FALLBACK_INTENT, reason: "LOW_CONFIDENCE" };
  }
  if (intent === PUBLIC_WORKS_INTENT) {
    const city = readCityService(publicWorksText(event));
    if (city?.emergency) return { type: "emergency", reason: "EMERGENCY" };
    return { type: "complete" };
  }
  if (intent === "InformationRequest") {
    return { type: "complete" };
  }
  if (intent === WELCOME_INTENT) {
    return { type: "complete" };
  }
  return { type: "complete" };
}

function publicWorksText(event: LexV2Event): string {
  const attrs = event.sessionState.sessionAttributes ?? {};
  const slots = event.sessionState.intent.slots ?? {};
  return [
    attrs.transcript,
    attrs.cityIssue,
    event.inputTranscript,
    slots.PublicWorksIssueType?.value?.interpretedValue,
    slots.PublicWorksLocation?.value?.interpretedValue,
  ]
    .filter(Boolean)
    .join(" ");
}

function cityServiceClosing(
  closing: string,
  intentName: string,
  department: string | undefined,
  spanish: boolean,
): string {
  if (intentName !== PUBLIC_WORKS_INTENT || !department?.trim()) return closing;
  const note = spanish ? `Esto queda con ${department}.` : `This is going to ${department}.`;
  if (closing.includes("We've got it.")) {
    return closing.replace("We've got it.", `We've got it. ${note}`);
  }
  return `${note} ${closing}`;
}

export async function handleFulfillment(event: LexV2Event): Promise<LexV2Response> {
  const sessionAttrs = { ...(event.sessionState.sessionAttributes ?? {}) };
  const agencyId = sessionAttrs.agencyId ?? "";
  const callId = sessionAttrs.callId ?? event.sessionId;
  const smsChannel = sessionAttrs.channel === "sms";
  const config = await getLexTenantConfig(agencyId || "unknown");
  const slots = extractCurrentSlots(event);
  const locale = event.bot?.localeId ?? sessionAttrs.locale ?? "en-US";

  if (event.sessionState.intent.name === WELCOME_INTENT) {
    return handleSessionStart(event);
  }

  const action = resolveFulfillmentAction(event, { surgeMode: config?.surgeMode === true });
  const shortName = agencyShortName(config);
  const utterance = event.inputTranscript ?? "";

  if (action.type === "emergency") {
    const summary = buildTransferSummary(
      utterance || (action.reason === "EMERGENCY" ? "caller confirmed a weapon" : "caller confirmed injuries"),
      slots,
      shortName,
    );
    if (smsChannel) {
      return closeTransferResponse(
        EMERGENCY_INTENT,
        summary,
        { ...sessionAttrs, agencyId, callId, classification: EMERGENCY_INTENT },
        [plain("This sounds like an emergency. Do not continue by text. Call 911 now.")],
        action.reason,
        { endSession: true },
      );
    }
    const parts = escalationCloseParts(
      config,
      locale,
      { ...sessionAttrs, agencyId, callId, classification: EMERGENCY_INTENT },
      transferPrompt(config, "EMERGENCY"),
      utterance,
    );
    return closeTransferResponse(
      EMERGENCY_INTENT,
      summary,
      parts.sessionAttributes,
      parts.messages,
      action.reason,
      { endSession: parts.endSession },
    );
  }

  if (action.type === "human") {
    if (smsChannel) {
      const spoken =
        "A team member can follow up if needed. If this is an emergency, call 911. You can also call this number to speak with someone.";
      return closeTransferResponse(
        action.intentName,
        utterance || action.intentName,
        { ...sessionAttrs, agencyId, callId, classification: sessionAttrs.classification ?? action.intentName },
        [plain(spoken)],
        action.reason,
      );
    }
    const spoken =
      action.reason === "EXTERNAL_311"
        ? `This sounds like a public works issue. I'm going to transfer you now, and I'll share a summary of what you've told me. One moment.`
        : transferPrompt(config, action.reason === "HUMAN_REQUEST" ? "HUMAN_REQUEST" : "LOW_CONFIDENCE");
    return closeTransferResponse(
      action.intentName,
      utterance || action.intentName,
      { ...sessionAttrs, agencyId, callId, classification: sessionAttrs.classification ?? action.intentName },
        [speakForEngine(spoken, sessionAttrs.voiceEngine)],
      action.reason,
    );
  }

  const priorSession = agencyId && callId ? await getLexSession(agencyId, callId).catch(() => null) : null;
  const priorUtterances = priorSession?.utterances ?? [];
  const caseNumber = generateCallAssistConfirmation({ agencyId: agencyId || "unknown", config });
  const classification = sessionAttrs.classification ?? event.sessionState.intent.name;
  const now = new Date().toISOString();
  const cadPayload = buildCadPayload(agencyId, classification, slots, config);
  const intake = mergeIntakeFromLexSlots(slots, {
    locationText: cadPayload.location ?? undefined,
    apartmentSuite: cadPayload.aptBusiness ?? undefined,
    crossStreets: cadPayload.crossStreets ?? undefined,
    callbackNumber: cadPayload.callbackNumber ?? sessionAttrs.callbackNumber ?? undefined,
    callerName: cadPayload.callerName ?? undefined,
    vehiclePlate: cadPayload.licensePlate ?? undefined,
    suspectDescription: cadPayload.suspectDesc ?? undefined,
    weaponsMentioned: cadPayload.weaponsPresent || undefined,
    injuries: cadPayload.injuriesPresent || undefined,
    summary: cadPayload.notes || undefined,
    language: sessionAttrs.language,
    preferredLanguage: sessionAttrs.preferredLanguage ?? sessionAttrs.language,
    incidentTypeHint: classification,
  });

  let knowledgeHit = false;
  let knowledgeArticleId: string | undefined;
  if (event.sessionState.intent.name === "InformationRequest") {
    const articles = await listLexKnowledge(agencyId || "unknown").catch(() => []);
    const query = slots.InformationTopic || utterance || "";
    const hit = topKnowledgeHit(query, articles as KnowledgeArticleLike[]);
    knowledgeHit = Boolean(hit);
    knowledgeArticleId = hit?.articleId;
    const grounded = assertGroundedReply({
      proposedText: hit ? `${hit.title}. ${hit.excerpt}` : closingPrompt(config, classification, caseNumber),
      knowledgeHit: Boolean(hit),
      isEmergencyTransfer: false,
      requiresKnowledge: true,
    });
    if (!grounded.allowed) {
      return closeTransferResponse(
        FALLBACK_INTENT,
        utterance || "ungrounded information request",
        { ...sessionAttrs, agencyId, callId, classification: FALLBACK_INTENT, knowledgeHit: "false" },
        [speakForEngine(transferPrompt(config, "LOW_CONFIDENCE"), sessionAttrs.voiceEngine)],
        "LOW_CONFIDENCE",
      );
    }
  }

  const sessionDraft: CallAssistSessionRecord = {
    agencyId,
    sessionId: callId,
    state: "COMPLETED",
    mode: "NON_EMERGENCY",
    source: "LIVE",
    language: sessionAttrs.language ?? "en",
    ttyMode: sessionAttrs.ttyMode === "1" || sessionAttrs.ttyMode === "true",
    smsFallbackRecommended: sessionAttrs.smsFallbackRecommended === "1",
    connectContactId: callId,
    disclosureDelivered: true,
    utterances: mergeDashboardUtterances(
      priorUtterances,
      utterancesFromLexTranscript(sessionAttrs.transcript ?? "", now),
      "",
      now,
    ),
    intake,
    continueAiConversation: false,
    legalHold: false,
    createdAt: priorSession?.createdAt ?? sessionAttrs.callStartedAt ?? now,
    updatedAt: now,
    completedAt: now,
    cadPushStatus: "not_pushed",
    caseNumber,
    cadPayload: { ...cadPayload },
    knowledgeHit,
    knowledgeArticleId,
    lastConfidence: Number.parseFloat(sessionAttrs.lastConfidence ?? "") || undefined,
    qaLowConfidence: sessionAttrs.confidenceAction === "escalate_human",
    aliAddress: sessionAttrs.aliAddress,
    bargeInCount: Number.parseInt(sessionAttrs.bargeInCount ?? "0", 10) || undefined,
  };

  let confirmationNumber = caseNumber;
  let departmentId = "";
  let savedSession: CallAssistSessionRecord = sessionDraft;
  try {
    const finalized = await finalizeCallAssistIntake({
      agencyId: agencyId || "unknown",
      actorId: "system:lex-fulfillment",
      session: sessionDraft,
      config,
      confirmationNumber: caseNumber,
      skipConfirmationSms: smsChannel,
    });
    confirmationNumber = finalized.confirmationNumber;
    departmentId = finalized.departmentId;
    savedSession = finalized.session;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "call_assist_finalize_failed",
        agencyId,
        callId,
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
  }

  const closingBase = cityServiceClosing(
    closingPrompt(config, classification, confirmationNumber),
    event.sessionState.intent.name,
    sessionAttrs.cityDepartment,
    (sessionAttrs.language ?? locale).toLowerCase().startsWith("es"),
  );
  const afterHours =
    event.sessionState.intent.name === "PublicWorksIssue"
      ? municipalAfterHoursNote(new Date(), "America/Chicago", sessionAttrs.language ?? locale)
      : null;
  const closingWithHours = afterHours ? `${closingBase} ${afterHours}` : closingBase;
  const closing = smsChannel
    ? smsClosingForIntent(event.sessionState.intent.name, confirmationNumber)
    : spokenClosingWithConfirmation({
        closingBase: closingWithHours,
        confirmationNumber,
      });
  const spanish = (sessionAttrs.language ?? locale).toLowerCase().startsWith("es");
  const followup = spanish
    ? "¿Hay algo más en lo que le pueda ayudar?"
    : "Is there anything else I can help you with?";
  const spokenOnDashboard = smsChannel ? closing : `${closing} ${followup}`;
  try {
    await putLexSession({
      ...savedSession,
      utterances: mergeDashboardUtterances(savedSession.utterances ?? [], [], spokenOnDashboard, now),
    });
  } catch {
    /* The caller still hears the report number if the dashboard write fails. */
  }
  const saved = {
    ...sessionAttrs,
    caseNumber: confirmationNumber,
    confirmationNumber,
    departmentId,
    disposition: "AI_RESOLVED",
    closingMessage: closing,
    classification,
  };
  if (smsChannel) {
    return {
      sessionState: {
        sessionAttributes: { ...saved, transferReason: "COMPLETE" },
        dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
        intent: { name: event.sessionState.intent.name, state: "Fulfilled" },
      },
      messages: [{ contentType: "PlainText", content: closing }],
    };
  }
  return elicitIntentResponse(
    FALLBACK_INTENT,
    { ...saved, awaitingAnythingElse: "true" },
    [speakForEngine(`${closing} ${followup}`, sessionAttrs.voiceEngine)],
  );
}

export const handler = handleFulfillment;
