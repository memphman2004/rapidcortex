import {
  assertGroundedReply,
  mergeIntakeFromLexSlots,
  topKnowledgeHit,
  type KnowledgeArticleLike,
} from "rapid-cortex-shared";
import { makeId } from "../../lib/ids.js";
import type { CallAssistSessionRecord } from "../store.js";
import { getLexTenantConfig, listLexKnowledge, putLexSession } from "./runtime-store.js";
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
import { closeTransferResponse, ssml } from "./lex-responses.js";
import { buildTransferSummary } from "./safety-gate.js";
import type { LexV2Event, LexV2Response } from "./types.js";
import { escalationCloseParts, handleSessionStart } from "./session-start.js";

export type FulfillmentAction =
  | { type: "emergency"; reason: Extract<TransferReason, "EMERGENCY" | "INJURY_PRIORITY"> }
  | { type: "human"; intentName: string; reason: TransferReason }
  | { type: "complete" };

/** Intercept before Dynamo write so Lex cannot continue slot collection after a weapon/injury yes. */
export function resolveFulfillmentAction(event: LexV2Event): FulfillmentAction {
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
    return { type: "human", intentName: FALLBACK_INTENT, reason: "LOW_CONFIDENCE" };
  }
  if (intent === PUBLIC_WORKS_INTENT) {
    return { type: "human", intentName: PUBLIC_WORKS_INTENT, reason: "EXTERNAL_311" };
  }
  if (intent === "InformationRequest") {
    return { type: "complete" };
  }
  if (intent === WELCOME_INTENT) {
    return { type: "complete" };
  }
  return { type: "complete" };
}

export async function handleFulfillment(event: LexV2Event): Promise<LexV2Response> {
  const sessionAttrs = { ...(event.sessionState.sessionAttributes ?? {}) };
  const agencyId = sessionAttrs.agencyId ?? "";
  const callId = sessionAttrs.callId ?? event.sessionId;
  const config = await getLexTenantConfig(agencyId || "unknown");
  const slots = extractCurrentSlots(event);
  const locale = event.bot?.localeId ?? sessionAttrs.locale ?? "en-US";

  if (event.sessionState.intent.name === WELCOME_INTENT) {
    return handleSessionStart(event);
  }

  const action = resolveFulfillmentAction(event);
  const shortName = agencyShortName(config);
  const utterance = event.inputTranscript ?? "";

  if (action.type === "emergency") {
    const summary = buildTransferSummary(
      utterance || (action.reason === "EMERGENCY" ? "caller confirmed a weapon" : "caller confirmed injuries"),
      slots,
      shortName,
    );
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
    const spoken =
      action.reason === "EXTERNAL_311"
        ? `This sounds like a public works issue. I'm going to transfer you now, and I'll share a summary of what you've told me. One moment.`
        : transferPrompt(config, action.reason === "HUMAN_REQUEST" ? "HUMAN_REQUEST" : "LOW_CONFIDENCE");
    return closeTransferResponse(
      action.intentName,
      utterance || action.intentName,
      { ...sessionAttrs, agencyId, callId, classification: sessionAttrs.classification ?? action.intentName },
      [ssml(spoken)],
      action.reason,
    );
  }

  const caseNumber = `RC-${makeId("case").slice(-8).toUpperCase()}`;
  const classification = sessionAttrs.classification ?? event.sessionState.intent.name;
  const now = new Date().toISOString();
  const cadPayload = buildCadPayload(agencyId, classification, slots, config);
  const intake = mergeIntakeFromLexSlots(slots, {
    locationText: cadPayload.location ?? undefined,
    apartmentSuite: cadPayload.aptBusiness ?? undefined,
    crossStreets: cadPayload.crossStreets ?? undefined,
    callbackNumber: cadPayload.callbackNumber ?? undefined,
    callerName: cadPayload.callerName ?? undefined,
    vehiclePlate: cadPayload.licensePlate ?? undefined,
    suspectDescription: cadPayload.suspectDesc ?? undefined,
    weaponsMentioned: cadPayload.weaponsPresent || undefined,
    injuries: cadPayload.injuriesPresent || undefined,
    summary: cadPayload.notes || undefined,
    language: sessionAttrs.language,
    preferredLanguage: sessionAttrs.preferredLanguage ?? sessionAttrs.language,
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
        [ssml(transferPrompt(config, "LOW_CONFIDENCE"))],
        "LOW_CONFIDENCE",
      );
    }
  }

  const session: CallAssistSessionRecord = {
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
    utterances: (sessionAttrs.transcript ?? "")
      .split("|")
      .filter(Boolean)
      .map((text, i) => ({ sequence: i, speaker: "caller", text: text.replace(/^Caller:\s*/, ""), at: now })),
    intake,
    continueAiConversation: false,
    legalHold: false,
    createdAt: sessionAttrs.callStartedAt ?? now,
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

  await putLexSession(session);

  const closing = closingPrompt(config, classification, caseNumber);
  return {
    sessionState: {
      sessionAttributes: {
        ...sessionAttrs,
        caseNumber,
        disposition: "AI_RESOLVED",
        transferReason: "COMPLETE",
        closingMessage: closing,
      },
      dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
      intent: { name: event.sessionState.intent.name, state: "Fulfilled" },
    },
    messages: [{ contentType: "PlainText", content: closing }],
  };
}

export const handler = handleFulfillment;
