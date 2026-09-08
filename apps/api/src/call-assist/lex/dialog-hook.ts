import {
  callerRequestedHuman,
  detectCallAssistLanguage,
  detectTtyMode,
  evaluateConfidenceDecision,
  extractIntakeFields,
  formatTtySms,
  groundedKnowledgeReply,
  mergeIntakeFromLexSlots,
  resolveAgencyTaxonomy,
  shouldTryBedrockFallback,
  topKnowledgeHit,
  type AgencyTaxonomy,
  type CallIntakeData,
  type KnowledgeArticleLike,
} from "rapid-cortex-shared";
import { ingestConnectCallerIdentity, intakeFromCallerIdentity } from "../telephony/ani-ali.js";
import type { CallAssistKnowledgeArticle, CallAssistTenantConfig } from "../store.js";
import { classifyWithBedrock, findCallTypeForIntent } from "./intent-classifier.js";
import {
  accidentInjuriesYes,
  animalThreatIsAggressive,
  EMERGENCY_INTENT,
  FALLBACK_INTENT,
  PUBLIC_WORKS_INTENT,
  REPEAT_CALL_INTENT,
  REQUEST_HUMAN_INTENT,
  weaponVisibleYes,
} from "./dialog-intercept.js";
import { LEX_SPEC_CONFIRMATION_INTENTS, LEX_SPEC_SLOTS } from "./lex-spec-slots.js";
import {
  closeTransferResponse,
  delegateResponse,
  elicitSlotResponse,
  plain,
  ssml,
} from "./lex-responses.js";
import { agencyShortName, slotPrompt, transferPrompt } from "./prompts.js";
import { handleFulfillment } from "./fulfillment-hook.js";
import { getLexSession, getLexTenantConfig, listLexKnowledge, updateLexSession } from "./runtime-store.js";
import { buildTransferSummary, runSafetyGate } from "./safety-gate.js";
import { extractCurrentSlots, slotFilled } from "./slot-extractor.js";
import type { LexSlotValue, LexV2Event, LexV2Response } from "./types.js";
import {
  applyBargeIn,
  bargeInSessionPatch,
  detectBargeIn,
  readBargeInState,
} from "../telephony/barge-in.js";

export { EMERGENCY_INTENT, FALLBACK_INTENT };
/** @deprecated Agency thresholds from tenant config are the control plane. */
export const MIN_LEX_CONFIDENCE = 0.7;

const INFORMATION_REQUEST_INTENT = "InformationRequest";
const IMPLICIT_FILLED = new Set(["incidentType", "concernType", "reportType"]);

export type DialogHookDeps = {
  getConfig: (agencyId: string) => Promise<CallAssistTenantConfig>;
  classify: typeof classifyWithBedrock;
  getSession: typeof getLexSession;
  updateSession: typeof updateLexSession;
  listKnowledge?: (agencyId: string) => Promise<CallAssistKnowledgeArticle[]>;
};

const defaultDeps: DialogHookDeps = {
  getConfig: getLexTenantConfig,
  classify: classifyWithBedrock,
  getSession: getLexSession,
  updateSession: updateLexSession,
  listKnowledge: listLexKnowledge,
};

export const handler = async (event: LexV2Event): Promise<LexV2Response> => {
  if (event.invocationSource === "FulfillmentCodeHook") {
    return handleFulfillment(event);
  }
  return handleDialog(event);
};

export async function handleDialog(
  event: LexV2Event,
  deps: DialogHookDeps = defaultDeps,
): Promise<LexV2Response> {
  const sessionAttrs = { ...(event.sessionState.sessionAttributes ?? {}) };
  const agencyId = sessionAttrs.agencyId ?? "";
  const callId = sessionAttrs.callId ?? event.sessionId;
  const utterance = event.inputTranscript ?? "";
  const localeId = event.bot?.localeId ?? (sessionAttrs.language === "es" ? "es_US" : "en_US");
  const preferredFromLocale = localeId.toLowerCase().startsWith("es") ? "es" : localeId.toLowerCase().startsWith("en") ? "en" : "und";
  const detectedLang = detectCallAssistLanguage(utterance);
  const language = detectedLang !== "und" ? detectedLang : preferredFromLocale;
  const tty = detectTtyMode({
    connectAttributes: sessionAttrs,
    mediaType: sessionAttrs.mediaType,
  });
  const currentSlots = event.sessionState.intent.slots ?? {};
  const now = new Date().toISOString();

  const config = agencyId ? await deps.getConfig(agencyId).catch(() => null) : null;
  const shortName = config ? agencyShortName(config) : "Call Assist";
  const thresholds = config?.confidenceThresholds;

  const emergencySpoken = config
    ? transferPrompt(config, "EMERGENCY")
    : "I'm connecting you to a dispatcher right now. Please stay on the line.";

  const transcript = [...(sessionAttrs.transcript ?? "").split("|").filter(Boolean), utterance ? `Caller: ${utterance}` : ""]
    .filter(Boolean)
    .join("|");

  if (utterance) {
    const safety = runSafetyGate(utterance);
    if (safety.isEmergency) {
      return emergencyClose(deps, event, config, shortName, emergencySpoken, {
        ...sessionAttrs,
        agencyId,
        callId,
        transcript,
      });
    }
  }

  if (weaponVisibleYes(currentSlots) || accidentInjuriesYes(currentSlots)) {
    const slots = extractCurrentSlots(event);
    const summary = buildTransferSummary(
      utterance || (weaponVisibleYes(currentSlots) ? "caller confirmed a weapon" : "caller confirmed injuries"),
      slots,
      shortName,
    );
    return persistAndCloseEmergency(deps, agencyId, callId, summary, sessionAttrs, emergencySpoken, transcript, slots);
  }

  if (event.sessionState.intent.name === EMERGENCY_INTENT) {
    return emergencyClose(deps, event, config, shortName, emergencySpoken, {
      ...sessionAttrs,
      agencyId,
      callId,
      transcript,
    });
  }

  const tenant = config ?? (await deps.getConfig(agencyId || "unknown"));
  const taxonomy = resolveAgencyTaxonomy(tenant);

  const topInterpretation = event.interpretations?.[0];
  const lexConfidence = topInterpretation?.nluConfidence ?? 0;
  const lexSentiment = topInterpretation?.sentimentResponse;
  if (lexSentiment?.sentiment) {
    sessionAttrs.sentiment = lexSentiment.sentiment;
    sessionAttrs.sentimentNegative = String(lexSentiment.sentimentScore?.negative ?? "");
  }
  let activeIntent = event.sessionState.intent.name;
  let confidenceSource: "lex" | "bedrock" = "lex";
  let effectiveScore = lexConfidence;

  if (callerRequestedHuman(utterance) || activeIntent === REQUEST_HUMAN_INTENT) {
    return closeTransferResponse(
      REQUEST_HUMAN_INTENT,
      utterance || "caller requested a person",
      { ...sessionAttrs, agencyId, callId, classification: REQUEST_HUMAN_INTENT, transcript },
      [ssml(transferPrompt(tenant, "HUMAN_REQUEST"))],
      "HUMAN_REQUEST",
    );
  }

  if (
    shouldTryBedrockFallback({
      lexConfidence,
      intentName: activeIntent,
      fallbackIntentName: FALLBACK_INTENT,
      thresholds,
    })
  ) {
    const history = (sessionAttrs.transcript ?? "").split("|").filter(Boolean);
    const bedrockResult = await deps.classify(utterance, history, taxonomy, thresholds);
    if (bedrockResult.intentName !== FALLBACK_INTENT && bedrockResult.confidence >= lexConfidence) {
      activeIntent = bedrockResult.intentName;
      confidenceSource = "bedrock";
      effectiveScore = bedrockResult.confidence;
    }
  }

  const slotMap = extractCurrentSlots(event);
  const identity = ingestConnectCallerIdentity({
    ani: sessionAttrs.ani ?? sessionAttrs.ANI,
    attributes: sessionAttrs,
  });
  const intake = mergeIntakeFromLexSlots(
    slotMap,
    extractIntakeFields(utterance, {
      ...intakeFromCallerIdentity(identity),
      language,
      preferredLanguage: language,
    }),
  );
  if (!intake.preferredLanguage) {
    intake.preferredLanguage = language;
    intake.language = language;
  }

  const decision = evaluateConfidenceDecision({
    score: effectiveScore,
    source: confidenceSource,
    thresholds,
  });

  if (decision.action === "escalate_human" || activeIntent === FALLBACK_INTENT) {
    await persistTurn(deps, agencyId, callId, {
      decision,
      utterance,
      intake,
      transferred: true,
      qaLowConfidence: true,
    });
    return closeTransferResponse(
      FALLBACK_INTENT,
      utterance,
      {
        ...sessionAttrs,
        agencyId,
        callId,
        transcript,
        lastConfidence: String(decision.score),
        confidenceAction: decision.action,
        confidenceSource,
      },
      [ssml(transferPrompt(tenant, "LOW_CONFIDENCE"))],
      "LOW_CONFIDENCE",
    );
  }

  const prompted = sessionAttrs.promptSlot;
  const interrupted = detectBargeIn(sessionAttrs, utterance, {
    promptedSlotFilled: Boolean(prompted && slotFilled(currentSlots[prompted])),
  });
  let missingSlotId = nextMissingSlot(activeIntent, currentSlots, taxonomy);
  if (!missingSlotId) missingSlotId = nextResponderSlot(activeIntent, currentSlots, intake);
  const barge = applyBargeIn({
    prior: readBargeInState(sessionAttrs),
    event: { interrupted, utterance, previousPromptSlot: sessionAttrs.promptSlot, at: now },
    nextMissingSlot: missingSlotId,
  });

  const updatedAttrs: Record<string, string> = {
    ...sessionAttrs,
    agencyId,
    callId,
    classification: activeIntent,
    confidence: String(effectiveScore),
    lastConfidence: String(decision.score),
    confidenceAction: decision.action,
    confidenceSource,
    transcript,
    language,
    preferredLanguage: language,
    ttyMode: tty.ttyMode ? "1" : "0",
    smsFallbackRecommended: tty.smsFallbackRecommended ? "1" : "0",
    ...bargeInSessionPatch(barge),
    ...(animalThreatIsAggressive(currentSlots) ? { officerPriority: "ELEVATED" } : {}),
    ...(identity.ani ? { ani: identity.ani } : {}),
    ...(identity.aliAddress ? { aliAddress: identity.aliAddress } : {}),
  };

    await persistTurn(deps, agencyId, callId, {
      decision,
      utterance,
      intake,
      transferred: false,
      bargeInCount: barge.bargeInCount,
      lastBargeInAt: barge.lastBargeInAt,
      qaLowConfidence: decision.belowSelfService,
      language,
      ttyMode: tty.ttyMode,
      smsFallbackRecommended: tty.smsFallbackRecommended,
    });

  if (decision.action === "continue_review") {
    updatedAttrs.humanReviewRequired = "true";
  }

  if (activeIntent === INFORMATION_REQUEST_INTENT) {
    const kb = await groundedInformationReply(deps, agencyId, utterance, currentSlots, tenant);
    if (kb.kind === "transfer") {
      await persistTurn(deps, agencyId, callId, {
        decision,
        utterance,
        intake,
        transferred: true,
        knowledgeHit: false,
        qaLowConfidence: true,
      });
      return closeTransferResponse(FALLBACK_INTENT, utterance, updatedAttrs, [ssml(kb.spoken)], "LOW_CONFIDENCE");
    }
    if (kb.kind === "answer") {
      updatedAttrs.knowledgeHit = "true";
      updatedAttrs.knowledgeArticleId = kb.articleId;
      await persistTurn(deps, agencyId, callId, {
        decision,
        utterance,
        intake,
        transferred: false,
        knowledgeHit: true,
        knowledgeArticleId: kb.articleId,
      });
      return {
        sessionState: {
          sessionAttributes: updatedAttrs,
          dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
          intent: { name: INFORMATION_REQUEST_INTENT, state: "Fulfilled" },
        },
        messages: [plain(kb.spoken)],
      };
    }
  }

  if (missingSlotId) {
    const prompt = slotPrompt(tenant, missingSlotId, localeId, activeIntent);
    const spoken = tty.ttyMode ? formatTtySms(prompt) : prompt;
    if (tty.smsFallbackRecommended) updatedAttrs.ttySmsScript = formatTtySms(prompt);
    return elicitSlotResponse(activeIntent, missingSlotId, currentSlots, updatedAttrs, [
      tty.ttyMode ? plain(spoken) : plain(prompt),
    ]);
  }

  if (activeIntent === REPEAT_CALL_INTENT || activeIntent === PUBLIC_WORKS_INTENT) {
    return delegateResponse(activeIntent, currentSlots, updatedAttrs, true);
  }

  const waitForConfirm = LEX_SPEC_CONFIRMATION_INTENTS.has(activeIntent);
  return delegateResponse(activeIntent, currentSlots, updatedAttrs, !waitForConfirm);
}

async function persistTurn(
  deps: DialogHookDeps,
  agencyId: string,
  callId: string,
  opts: {
    decision: ReturnType<typeof evaluateConfidenceDecision>;
    utterance: string;
    intake: CallIntakeData;
    transferred: boolean;
    bargeInCount?: number;
    lastBargeInAt?: string;
    knowledgeHit?: boolean;
    knowledgeArticleId?: string;
    qaLowConfidence?: boolean;
    language?: string;
    ttyMode?: boolean;
    smsFallbackRecommended?: boolean;
  },
): Promise<void> {
  try {
    await deps.updateSession(agencyId, callId, {
      intake: opts.intake,
      lastConfidence: opts.decision.score,
      confidenceSource: opts.decision.source,
      confidenceAction: opts.decision.action,
      confidenceBelowThreshold: opts.decision.belowEscalate,
      qaLowConfidence: opts.qaLowConfidence ?? (opts.transferred || opts.decision.belowSelfService),
      lastConfidenceUtterance: opts.utterance.slice(0, 120),
      ...(opts.language ? { language: opts.language } : {}),
      ...(opts.ttyMode !== undefined ? { ttyMode: opts.ttyMode } : {}),
      ...(opts.smsFallbackRecommended !== undefined
        ? { smsFallbackRecommended: opts.smsFallbackRecommended }
        : {}),
      ...(opts.bargeInCount !== undefined ? { bargeInCount: opts.bargeInCount } : {}),
      ...(opts.lastBargeInAt ? { lastBargeInAt: opts.lastBargeInAt } : {}),
      ...(opts.knowledgeHit !== undefined ? { knowledgeHit: opts.knowledgeHit } : {}),
      ...(opts.knowledgeArticleId ? { knowledgeArticleId: opts.knowledgeArticleId } : {}),
      ...(opts.transferred ? { continueAiConversation: false } : {}),
    });
  } catch {
    /* session row may not exist yet */
  }
}

async function groundedInformationReply(
  deps: DialogHookDeps,
  agencyId: string,
  utterance: string,
  currentSlots: Record<string, LexSlotValue | null>,
  tenant: CallAssistTenantConfig,
): Promise<
  { kind: "elicit" } | { kind: "answer"; spoken: string; articleId: string } | { kind: "transfer"; spoken: string }
> {
  const topic =
    currentSlots.InformationTopic?.value?.interpretedValue?.trim() ||
    currentSlots.InformationTopic?.value?.originalValue?.trim() ||
    utterance;
  if (!topic) return { kind: "elicit" };
  const articles = (await deps.listKnowledge?.(agencyId).catch(() => [])) ?? [];
  const hit = topKnowledgeHit(topic, articles as KnowledgeArticleLike[]);
  const spoken = groundedKnowledgeReply({
    proposedText: hit ? `${hit.title}. ${hit.excerpt}` : "",
    knowledgeHit: Boolean(hit),
    requiresKnowledge: true,
  });
  if (!hit || spoken.startsWith("I don't have")) {
    return { kind: "transfer", spoken: transferPrompt(tenant, "LOW_CONFIDENCE") };
  }
  return { kind: "answer", spoken, articleId: hit.articleId };
}

async function emergencyClose(
  deps: DialogHookDeps,
  event: LexV2Event,
  config: CallAssistTenantConfig | null,
  shortName: string,
  spoken: string,
  sessionAttrs: Record<string, string>,
): Promise<LexV2Response> {
  const utterance = event.inputTranscript ?? "";
  const slots = extractCurrentSlots(event);
  const summary = buildTransferSummary(utterance, slots, shortName);
  return persistAndCloseEmergency(
    deps,
    sessionAttrs.agencyId ?? "",
    sessionAttrs.callId ?? event.sessionId,
    summary,
    sessionAttrs,
    spoken,
    sessionAttrs.transcript ?? "",
    slots,
  );
}

async function persistAndCloseEmergency(
  deps: DialogHookDeps,
  agencyId: string,
  callId: string,
  summary: string,
  sessionAttrs: Record<string, string>,
  spoken: string,
  transcript: string,
  slots: Record<string, string | null> = {},
): Promise<LexV2Response> {
  const utterance = summary;
  const identity = ingestConnectCallerIdentity({
    ani: sessionAttrs.ani ?? sessionAttrs.ANI,
    attributes: sessionAttrs,
  });
  const intake = mergeIntakeFromLexSlots(slots, extractIntakeFields(utterance, intakeFromCallerIdentity(identity)));
  try {
    await deps.updateSession(agencyId, callId, {
      state: "TRANSFERRING_911",
      continueAiConversation: false,
      intake,
    });
  } catch {
    /* transfer anyway */
  }
  return closeTransferResponse(
    EMERGENCY_INTENT,
    summary,
    { ...sessionAttrs, agencyId, callId, classification: EMERGENCY_INTENT, transcript },
    [ssml(spoken)],
    "EMERGENCY",
  );
}

export function nextMissingSlot(
  intentId: string,
  currentSlots: Record<string, LexSlotValue | null>,
  taxonomy: AgencyTaxonomy,
): string | null {
  const specSlots = LEX_SPEC_SLOTS[intentId];
  const usesLegacyLocation = "location" in currentSlots;
  const usesSpecKeys = Boolean(specSlots?.some((slot) => slot.name in currentSlots));
  if (specSlots && specSlots.length > 0 && (usesSpecKeys || !usesLegacyLocation)) {
    for (const slot of specSlots) {
      if (!slot.required) continue;
      if (!slotFilled(currentSlots[slot.name])) return slot.name;
    }
    return null;
  }

  const callType = findCallTypeForIntent(taxonomy, intentId);
  if (!callType) {
    if (!slotFilled(currentSlots.location) && "location" in currentSlots) return "location";
    return null;
  }
  const template = taxonomy.intakeTemplates.find((t) => t.id === callType.intakeTemplateId);
  if (!template) return null;
  for (const field of template.fields) {
    if (!field.required) continue;
    if (IMPLICIT_FILLED.has(field.id)) continue;
    if (!slotFilled(currentSlots[field.id])) {
      if (field.id in currentSlots || field.id === "location") return field.id;
    }
  }
  for (const [name, slot] of Object.entries(currentSlots)) {
    if (IMPLICIT_FILLED.has(name)) continue;
    if (!slotFilled(slot)) return name;
  }
  return null;
}

const RESPONDER_SLOT_TO_INTAKE: Record<string, keyof CallIntakeData> = {
  AptBusiness: "apartmentSuite",
  CrossStreets: "crossStreets",
  VehicleColor: "vehicleColor",
  VehicleMake: "vehicleMake",
  VehicleModel: "vehicleModel",
  VehiclePlate: "vehiclePlate",
  VehicleYear: "vehicleYear",
};

/**
 * After required Lex slots, elicit responder-critical optional fields that exist
 * on the intent and are still empty (apt, cross streets, vehicle set).
 */
export function nextResponderSlot(
  intentId: string,
  currentSlots: Record<string, LexSlotValue | null>,
  intake: CallIntakeData,
): string | null {
  const specSlots = LEX_SPEC_SLOTS[intentId];
  if (!specSlots?.some((slot) => slot.name in currentSlots)) return null;
  for (const slot of specSlots) {
    const field = RESPONDER_SLOT_TO_INTAKE[slot.name];
    if (!field) continue;
    if (slotFilled(currentSlots[slot.name])) continue;
    const current = intake[field];
    if (typeof current === "boolean" ? true : Boolean(current && String(current).trim())) continue;
    return slot.name;
  }
  return null;
}
