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
import { closeTransferResponse, holdIntentPromptResponse, plain, speakForEngine } from "./lex-responses.js";
import { buildTransferSummary, transferSummaryReasonLabel } from "./safety-gate.js";
import type { LexV2Event, LexV2Response } from "./types.js";
import { escalationCloseParts, handleSessionStart } from "./session-start.js";
import { smsClosingForIntent } from "../sms-channel/sms-copy.js";
import {
  finalizeCallAssistIntake,
  generateCallAssistConfirmation,
  spokenClosingWithConfirmation,
  spokenClosingWithConfirmationAndRepeatAsk,
} from "../finalize-intake.js";
import { callAssistStore } from "../store.js";
import {
  isCaseLifecycleEnabled,
  caseStatusReadout,
  caseNotFoundVoice,
  reopenAcknowledgementVoice,
  escalationAcknowledgementVoice,
  escalationCapVoice,
  formatConfirmationForSpeech,
  isValidConfirmationFormat,
} from "rapid-cortex-shared";

/** Constant — the Lex intent name for status/lifecycle check-in. */
const CHECK_STATUS_INTENT = "CheckServiceRequestStatus";

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
      {
        transferReason: action.reason === "EMERGENCY" ? "emergency" : "injury_priority",
        language: sessionAttrs.language || locale,
        transcript: sessionAttrs.transcript,
      },
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
    const humanSummary = buildTransferSummary(utterance || action.intentName, slots, shortName, {
      transferReason: transferSummaryReasonLabel(action.reason),
      language: sessionAttrs.language || locale,
      transcript: sessionAttrs.transcript,
    });
    if (smsChannel) {
      const spoken =
        "A team member can follow up if needed. If this is an emergency, call 911. You can also call this number to speak with someone.";
      return closeTransferResponse(
        action.intentName,
        humanSummary,
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
      humanSummary,
      { ...sessionAttrs, agencyId, callId, classification: sessionAttrs.classification ?? action.intentName },
        [speakForEngine(spoken, sessionAttrs.voiceEngine)],
      action.reason,
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 1 — Confirmation Loop: handle CheckServiceRequestStatus as a lookup,
  // not as a new service-request creation. This block fires ONLY when:
  //   (a) the tenant has confirmationLoopEnabled = true, AND
  //   (b) the intent is CheckServiceRequestStatus.
  // When either condition is false, execution falls through to the existing
  // finalizeCallAssistIntake path (today's behavior is fully preserved).
  // ---------------------------------------------------------------------------
  if (
    event.sessionState.intent.name === CHECK_STATUS_INTENT &&
    isCaseLifecycleEnabled(config)
  ) {
    const rawConfirmation = (
      slots.ServiceRequestNumber ??
      sessionAttrs.caseNumber ??
      sessionAttrs.confirmationNumber ??
      ""
    ).trim().toUpperCase();
    const subIssue = (slots.ServiceStatusSubIssue ?? "").trim().toLowerCase();
    const ani = (sessionAttrs.ani ?? sessionAttrs.ANI ?? "").trim();
    const isReopen = subIssue.includes("reopen") || subIssue.includes("re-open");
    const isEscalate = subIssue.includes("escalat");

    // --- Resolve the call record ---
    let record = isValidConfirmationFormat(rawConfirmation) && agencyId
      ? await callAssistStore.lookupCallRecord(agencyId, rawConfirmation).catch(() => null)
      : null;

    // ANI fallback: if caller didn't provide a number, check their phone number
    if (!record && ani && agencyId) {
      record = await callAssistStore.findLatestRecordByAni(agencyId, ani).catch(() => null);
    }

    if (!record) {
      // No record found — tell the caller and don't create a new SR
      const notFoundText = caseNotFoundVoice(rawConfirmation || "that number");
      return {
        sessionState: {
          sessionAttributes: { ...sessionAttrs, agencyId, callId },
          dialogAction: { type: "Close", fulfillmentState: "Failed" },
          intent: { name: CHECK_STATUS_INTENT, state: "Failed" },
        },
        messages: [{ contentType: "PlainText", content: notFoundText }],
      };
    }

    // --- Route based on sub-issue ---
    let responseText: string;
    let sessionEndAttributes = { ...sessionAttrs, agencyId, callId, confirmationNumber: record.confirmationNumber };

    if (isEscalate) {
      // Escalation requires explicit caller confirmation — the slot collection already
      // asked the caller to confirm before Lex called fulfillment. Write the escalation.
      const result = await callAssistStore.requestCaseEscalation({
        agencyId,
        confirmationNumber: record.confirmationNumber,
        note: `Citizen requested escalation via voice. Original transcript: ${(sessionAttrs.transcript ?? "").slice(0, 200)}`,
        updatedBy: "RESIDENT_VOICE",
      }).catch(() => null);

      if (!result) {
        // Store error — degrade gracefully
        responseText = `I noted your escalation request for report ${formatConfirmationForSpeech(record.confirmationNumber)}. Someone will follow up with you.`;
      } else if (!result.ok) {
        responseText =
          result.error === "ESCALATION_CAP_EXCEEDED"
            ? escalationCapVoice(formatConfirmationForSpeech(record.confirmationNumber))
            : result.error === "TERMINAL_STATUS"
              ? `Your report ${formatConfirmationForSpeech(record.confirmationNumber)} is in a final status and cannot be escalated. If you need help, please call back and we can open a new report.`
              : `I wasn't able to escalate that report right now. Please try again or call the non-emergency line. This is not 911.`;
      } else {
        responseText = escalationAcknowledgementVoice(formatConfirmationForSpeech(result.value.confirmationNumber));
      }
    } else if (isReopen) {
      const result = await callAssistStore.requestCaseReopen({
        agencyId,
        confirmationNumber: record.confirmationNumber,
        note: `Citizen requested reopen via voice.`,
        updatedBy: "RESIDENT_VOICE",
      }).catch(() => null);

      if (!result) {
        responseText = `I noted your reopen request for report ${formatConfirmationForSpeech(record.confirmationNumber)}. Someone will review it.`;
      } else if (!result.ok) {
        responseText =
          result.error === "REOPEN_ALREADY_PENDING"
            ? `A reopen request is already pending for report ${formatConfirmationForSpeech(record.confirmationNumber)}. The team will review it shortly.`
            : result.error === "TERMINAL_STATUS"
              ? `Report ${formatConfirmationForSpeech(record.confirmationNumber)} cannot be reopened. If the issue has returned, please describe it and I'll open a new report.`
              : `I noted your request but couldn't update the record. Please try again or call the non-emergency line.`;
      } else {
        responseText = reopenAcknowledgementVoice(formatConfirmationForSpeech(result.value.confirmationNumber));
      }
    } else {
      // Default: status readout
      const readout = caseStatusReadout(record);
      responseText = `${readout.voiceText} Is there anything else I can help you with?`;
    }

    if (smsChannel) {
      const smsText = (() => {
        const readout = caseStatusReadout(record);
        return isEscalate || isReopen ? responseText : readout.smsText;
      })();
      return {
        sessionState: {
          sessionAttributes: { ...sessionEndAttributes, transferReason: "COMPLETE" },
          dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
          intent: { name: CHECK_STATUS_INTENT, state: "Fulfilled" },
        },
        messages: [{ contentType: "PlainText", content: smsText }],
      };
    }

    // Voice: keep session open briefly for follow-up
    return holdIntentPromptResponse(
      CHECK_STATUS_INTENT,
      {},
      { ...sessionEndAttributes, awaitingAnythingElse: "true", transferReason: "COMPLETE" },
      [speakForEngine(responseText, sessionAttrs.voiceEngine)],
    );
  }
  // --- end Phase 1 confirmation loop ---

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
      const ungroundedSummary = buildTransferSummary(
        utterance || "ungrounded information request",
        slots,
        shortName,
        {
          transferReason: transferSummaryReasonLabel("LOW_CONFIDENCE"),
          language: sessionAttrs.language || locale,
          transcript: sessionAttrs.transcript,
        },
      );
      return closeTransferResponse(
        FALLBACK_INTENT,
        ungroundedSummary,
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

  const spanish = (sessionAttrs.language ?? locale).toLowerCase().startsWith("es");
  const closingBase = cityServiceClosing(
    closingPrompt(config, classification, confirmationNumber),
    event.sessionState.intent.name,
    sessionAttrs.cityDepartment,
    spanish,
  );
  const afterHours =
    event.sessionState.intent.name === "PublicWorksIssue"
      ? municipalAfterHoursNote(new Date(), "America/Chicago", sessionAttrs.language ?? locale)
      : null;
  const closingWithHours = afterHours ? `${closingBase} ${afterHours}` : closingBase;
  const closingPlain = smsChannel
    ? smsClosingForIntent(event.sessionState.intent.name, confirmationNumber)
    : spokenClosingWithConfirmation({
        closingBase: closingWithHours,
        confirmationNumber,
      });
  const closingVoice = spokenClosingWithConfirmationAndRepeatAsk({
    closingBase: closingWithHours,
    confirmationNumber,
    spanish,
  });
  const spokenOnDashboard = smsChannel ? closingPlain : closingVoice.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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
    closingMessage: closingPlain,
    classification,
  };
  if (smsChannel) {
    return {
      sessionState: {
        sessionAttributes: { ...saved, transferReason: "COMPLETE" },
        dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
        intent: { name: event.sessionState.intent.name, state: "Fulfilled" },
      },
      messages: [{ contentType: "PlainText", content: closingPlain }],
    };
  }
  // Keep Lex open so the caller can ask for a repeat before Connect disconnects.
  // ElicitIntent (InProgress) avoids "slot to elicit is invalid" across intent shapes.
  return holdIntentPromptResponse(
    event.sessionState.intent.name,
    event.sessionState.intent.slots ?? {},
    {
      ...saved,
      awaitingConfirmationRepeat: "true",
      awaitingAnythingElse: "false",
      transferReason: "COMPLETE",
      promptSlot: "CONFIRMATION_REPEAT",
    },
    [speakForEngine(closingVoice, sessionAttrs.voiceEngine)],
  );
}

export const handler = handleFulfillment;
