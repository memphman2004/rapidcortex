import {
  applyConversationTurn,
  callerRequestedHuman,
  callLanguageToLexLocale,
  conversationMemorySessionPatch,
  detectCallAssistLanguage,
  detectTtyMode,
  evaluateConfidenceDecision,
  extractIntakeFields,
  formatTtySms,
  groundedKnowledgeReply,
  isLocationSlot,
  knownFactLines,
  lexLocaleToCallLanguage,
  listedReasonReplacesIntent,
  locationReadback,
  closingSurveyPrompt,
  findSameDayReport,
  parseCallerSurveyScore,
  CONNECT_LANGUAGE_MENU_DTMF,
  CALL_ASSIST_LOCALE_META,
  mergeIntakeFromLexSlots,
  resolveAgencyTaxonomy,
  shouldTryBedrockFallback,
  surgeCompletesInsteadOfTransfer,
  spokenCorrectionAck,
  topKnowledgeHit,
  vehicleDescriptionSatisfied,
  type AgencyTaxonomy,
  type CallIntakeData,
  type KnowledgeArticleLike,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
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
  WELCOME_INTENT,
  weaponVisibleYes,
} from "./dialog-intercept.js";
import { LEX_SPEC_CONFIRMATION_INTENTS, LEX_SPEC_SLOTS } from "./lex-spec-slots.js";
import { readCityService } from "./city-service.js";
import { apply311Dialog } from "./taxonomy-311/apply-311-dialog.js";
import { INTENT_MAP as LEX_311_INTENT_MAP } from "./taxonomy-311/intents.js";
import { extractSlotsFromContext } from "./taxonomy-311/extract-slots-from-context.js";
import { remapLegacySmsSlots, SMS_LEGACY_TO_311 } from "./taxonomy-311/slot-catalog.js";
import {
  conversationalSlotValue,
  getNextElicitation,
  humanQuestionForSlot,
} from "./taxonomy-311/elicitation-questions.js";
import {
  closeTransferResponse,
  confirmIntentResponse,
  delegateResponse,
  elicitIntentResponse,
  elicitSlotResponse,
  plain,
  speakForEngine,
} from "./lex-responses.js";
import { agencyShortName, transferPrompt } from "./prompts.js";
import { handleFulfillment } from "./fulfillment-hook.js";
import {
  ensureCallerTranscriptLine,
  mergeDashboardUtterances,
  spokenTextFromLexMessage,
  utterancesFromLexTranscript,
} from "./lex-transcript.js";
import { getLexSession, getLexTenantConfig, listLexKnowledge, listRecentSessionsForDuplicate, updateLexSession } from "./runtime-store.js";
import { buildTransferSummary, callerTextForSafety, runSafetyGate } from "./safety-gate.js";
import { extractCurrentSlots, slotFilled, capturePromptedSlot, isVehicleDescriptionSlot } from "./slot-extractor.js";
import type { LexSlotValue, LexV2Event, LexV2Response } from "./types.js";
import {
  applyBargeIn,
  bargeInSessionPatch,
  detectBargeIn,
  readBargeInState,
} from "../telephony/barge-in.js";
import {
  applyAdaptiveEndpointing,
  readEndpointingState,
} from "../telephony/adaptive-endpointing.js";
import {
  escalationCloseParts,
  isCallAssistGreetingConfigEnabled,
  lexWelcomeResponse,
  startCallAssistSession,
} from "./session-start.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";

export { EMERGENCY_INTENT, FALLBACK_INTENT };
/** @deprecated Agency thresholds from tenant config are the control plane. */
export const MIN_LEX_CONFIDENCE = 0.7;

/** Language-menu DTMF and the silence after it are not a request. */
function isLanguageMenuNoise(utterance: string): boolean {
  const trimmed = utterance.trim();
  return trimmed.length === 0 || /^[1-7]$/.test(trimmed);
}

/** After a report number: yes starts another report, no ends the call. */
export function anythingElseChoice(utterance: string): "yes" | "no" | "reask" | "continue" {
  const trimmed = utterance
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/g, "")
    .replace(/\s+/g, " ");
  if (!trimmed) return "reask";
  if (/^(1|yes|yeah|yep|yup|sure|please|yes please|si|sí)$/.test(trimmed)) return "yes";
  if (
    /^(2|no|nope|nah|no thanks|no thank you|that'?s all|thats all|that'?s it|thats it|that'?s everything|nothing else|nothing|i'?m good|im good|goodbye|bye|that is all|that will be all|no that'?s it|nada|nada mas|nada más|eso es todo|adios|adiós)$/.test(
      trimmed,
    )
  ) {
    return "no";
  }
  return "continue";
}

const FLOW_TRANSFER_INTENTS = new Set([
  "EmergencyEscalation",
  "FallbackIntent",
  "RequestHuman",
  "RepeatCallCheck",
  "PublicWorksIssue",
]);

const INFORMATION_REQUEST_INTENT = "InformationRequest";
const IMPLICIT_FILLED = new Set(["incidentType", "concernType", "reportType"]);
const bargeAuditRepo = new AuditRepository();

export type DialogHookDeps = {
  getConfig: (agencyId: string) => Promise<CallAssistTenantConfig>;
  classify: typeof classifyWithBedrock;
  getSession: typeof getLexSession;
  updateSession: typeof updateLexSession;
  listKnowledge?: (agencyId: string) => Promise<CallAssistKnowledgeArticle[]>;
  listRecentSessions?: typeof listRecentSessionsForDuplicate;
};

const defaultDeps: DialogHookDeps = {
  getConfig: getLexTenantConfig,
  classify: classifyWithBedrock,
  getSession: getLexSession,
  updateSession: updateLexSession,
  listKnowledge: listLexKnowledge,
  listRecentSessions: listRecentSessionsForDuplicate,
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
  const response = await handleDialogTurn(event, deps);
  try {
    await syncDashboardTranscript(event, response, deps);
  } catch {
    /* A transcript write must not change what the caller hears. */
  }
  return response;
}

async function syncDashboardTranscript(
  event: LexV2Event,
  response: LexV2Response,
  deps: DialogHookDeps,
): Promise<void> {
  const attrs = response.sessionState?.sessionAttributes ?? event.sessionState.sessionAttributes ?? {};
  const agencyId = attrs.agencyId ?? "";
  const callId = attrs.callId ?? event.sessionId;
  if (!agencyId || !callId) return;
  const transcript = ensureCallerTranscriptLine(
    attrs.transcript ?? event.sessionState.sessionAttributes?.transcript ?? "",
    event.inputTranscript ?? "",
  );
  const spoken = (response.messages ?? [])
    .map((message) => spokenTextFromLexMessage(message.content))
    .filter(Boolean)
    .join(" ");
  const at = new Date().toISOString();
  const existingSession = await deps.getSession(agencyId, callId);
  const existing = existingSession?.utterances ?? [];
  if (response.sessionState && !attrs.callStartedAt) {
    response.sessionState.sessionAttributes = {
      ...attrs,
      callStartedAt: existingSession?.createdAt ?? at,
    };
  }
  const utterances = mergeDashboardUtterances(
    existing,
    utterancesFromLexTranscript(transcript, at),
    spoken,
    at,
  );
  if (utterances.length === 0) return;
  await deps.updateSession(agencyId, callId, { utterances });
}

async function handleDialogTurn(
  event: LexV2Event,
  deps: DialogHookDeps = defaultDeps,
): Promise<LexV2Response> {
  const sessionAttrs = { ...(event.sessionState.sessionAttributes ?? {}) };
  const agencyId = sessionAttrs.agencyId ?? "";
  const callId = sessionAttrs.callId ?? event.sessionId;
  let utterance = event.inputTranscript ?? "";
  const localeId = event.bot?.localeId ?? callLanguageToLexLocale(sessionAttrs.language);
  const preferredFromLocale = lexLocaleToCallLanguage(localeId);
  const detectedLang = detectCallAssistLanguage(utterance);
  const language = detectedLang !== "und" ? detectedLang : preferredFromLocale;
  const tty = detectTtyMode({
    connectAttributes: sessionAttrs,
    mediaType: sessionAttrs.mediaType,
  });
  let currentSlots = event.sessionState.intent.slots ?? {};
  const now = new Date().toISOString();

  const config = agencyId ? await deps.getConfig(agencyId).catch(() => null) : null;
  const shortName = config ? agencyShortName(config) : "Nexiq";
  const thresholds = config?.confidenceThresholds;

  let greetingPrefix: string | null = null;
  let welcomeStart: ReturnType<typeof startCallAssistSession> | null = null;
  const smsChannel = sessionAttrs.channel === "sms";
  if (isCallAssistGreetingConfigEnabled()) {
    welcomeStart = startCallAssistSession({
      agencyId,
      locale: localeId,
      existingAttributes: sessionAttrs,
      config,
    });
    Object.assign(sessionAttrs, welcomeStart.sessionAttributes);
    // Voice greeting is for phone only — SMS has its own welcome / keyword path.
    if (
      !smsChannel &&
      sessionAttrs.intakeStarted !== "true" &&
      event.sessionState.intent.name !== WELCOME_INTENT
    ) {
      greetingPrefix = welcomeStart.greeting;
      sessionAttrs.intakeStarted = "true";
    } else if (smsChannel && sessionAttrs.intakeStarted !== "true") {
      sessionAttrs.intakeStarted = "true";
    }
  }

  const emergencySpoken = config
    ? transferPrompt(config, "EMERGENCY")
    : "I'm connecting you to a dispatcher right now. Please stay on the line.";

  const transcript = [...(sessionAttrs.transcript ?? "").split("|").filter(Boolean), utterance ? `Caller: ${utterance}` : ""]
    .filter(Boolean)
    .join("|");

  if (utterance) {
    const safety = runSafetyGate(callerTextForSafety(transcript, utterance));
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
    return persistAndCloseEmergency(deps, agencyId, callId, summary, sessionAttrs, emergencySpoken, transcript, slots, config, localeId);
  }

  if (event.sessionState.intent.name === EMERGENCY_INTENT) {
    return emergencyClose(deps, event, config, shortName, emergencySpoken, {
      ...sessionAttrs,
      agencyId,
      callId,
      transcript,
    });
  }

  if (!smsChannel && sessionAttrs.awaitingSurvey === "true") {
    const score = parseCallerSurveyScore(utterance);
    const bye = language.startsWith("es") ? "Gracias por llamar. Adiós." : "Thank you for calling. Goodbye.";
    const doneIntent = FLOW_TRANSFER_INTENTS.has(sessionAttrs.classification ?? "")
      ? "InformationRequest"
      : sessionAttrs.classification || "InformationRequest";
    return {
      sessionState: {
        sessionAttributes: {
          ...sessionAttrs,
          agencyId,
          callId,
          transcript,
          awaitingSurvey: "false",
          callerDone: "true",
          ...(score ? { surveyScore: String(score) } : {}),
        },
        dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
        intent: { name: doneIntent, state: "Fulfilled" },
      },
      messages: [speakForEngine(bye, sessionAttrs.voiceEngine)],
    };
  }

  if (!smsChannel && sessionAttrs.awaitingLocationConfirm === "true") {
    const choice = anythingElseChoice(utterance);
    if (choice === "no") {
      sessionAttrs.awaitingLocationConfirm = "false";
      sessionAttrs.locationConfirmed = "false";
      sessionAttrs.pendingLocation = "";
      for (const name of Object.keys(currentSlots)) {
        if (isLocationSlot(name)) currentSlots[name] = null;
      }
    } else if (choice === "yes") {
      sessionAttrs.awaitingLocationConfirm = "false";
      sessionAttrs.locationConfirmed = "true";
    } else {
      const again = locationReadback(sessionAttrs.pendingLocation ?? "", language) ?? "Is that location right?";
      return elicitIntentResponse(FALLBACK_INTENT, { ...sessionAttrs, agencyId, callId, transcript }, [
        speakForEngine(again, sessionAttrs.voiceEngine),
      ]);
    }
  }

  if (!smsChannel && sessionAttrs.awaitingAnythingElse === "true") {
    const choice = anythingElseChoice(utterance);
    const spanish = language.startsWith("es");
    if (choice === "no") {
      const doneIntent = FLOW_TRANSFER_INTENTS.has(sessionAttrs.classification ?? "")
        ? "InformationRequest"
        : sessionAttrs.classification || "InformationRequest";
      return {
        sessionState: {
          sessionAttributes: {
            ...sessionAttrs,
            agencyId,
            callId,
            transcript,
            awaitingAnythingElse: "false",
            awaitingSurvey: "true",
          },
          dialogAction: { type: "ElicitIntent" },
          intent: { name: doneIntent, state: "InProgress" },
        },
        messages: [speakForEngine(closingSurveyPrompt(language), sessionAttrs.voiceEngine)],
      };
    }
    if (choice === "yes" || choice === "reask") {
      const ask =
        choice === "yes"
          ? spanish
            ? "¿En qué más le puedo ayudar?"
            : "What can I help you with?"
          : spanish
            ? "¿Hay algo más en lo que le pueda ayudar?"
            : "Is there anything else I can help you with?";
      return elicitIntentResponse(
        FALLBACK_INTENT,
        {
          ...sessionAttrs,
          agencyId,
          callId,
          transcript,
          awaitingAnythingElse: choice === "yes" ? "false" : "true",
          openingReprompted: "true",
          promptSlot: "",
        },
        [speakForEngine(ask, sessionAttrs.voiceEngine)],
      );
    }
    const stripped = utterance.replace(/^(yes|yeah|yep|yup|sure|sí|si)[,.\s]+/i, "").trim();
    if (stripped) utterance = stripped;
    sessionAttrs.awaitingAnythingElse = "false";
    sessionAttrs.openingReprompted = "true";
    sessionAttrs.promptSlot = "";
    currentSlots = {};
    event.sessionState.intent = {
      name: FALLBACK_INTENT,
      slots: {},
      state: "InProgress",
      confirmationState: "None",
    };
    event.interpretations = [{ intent: event.sessionState.intent, nluConfidence: 0.4 }];
  }

  if (event.sessionState.intent.name === WELCOME_INTENT) {
    return lexWelcomeResponse(
      welcomeStart ??
        startCallAssistSession({
          agencyId,
          locale: localeId,
          existingAttributes: sessionAttrs,
          config,
        }),
    );
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

  if (activeIntent === "RedirectToEmergencyServices") {
    return emergencyClose(deps, event, config, shortName, emergencySpoken, {
      ...sessionAttrs,
      agencyId,
      callId,
      transcript,
    });
  }

  if (activeIntent === "TransferToLiveAgent") {
    activeIntent = REQUEST_HUMAN_INTENT;
  }

  if (smsChannel) {
    const dest311 = SMS_LEGACY_TO_311[activeIntent];
    if (dest311 && LEX_311_INTENT_MAP[dest311]) {
      currentSlots = remapLegacySmsSlots(activeIntent, dest311, currentSlots);
      activeIntent = dest311;
    }
  }

  if (!smsChannel && sessionAttrs.openingReprompted !== "true" && isLanguageMenuNoise(utterance)) {
    const menuLocale = CONNECT_LANGUAGE_MENU_DTMF[utterance.trim()];
    const menuName = menuLocale ? CALL_ASSIST_LOCALE_META[menuLocale].label : "";
    const menuTranscript = menuName ? `${transcript}|Caller: chose ${menuName}` : transcript;
    const ask = language.startsWith("es")
      ? "Gracias. ¿En qué le puedo ayudar?"
      : "Thanks. What can I help you with?";
    return elicitIntentResponse(
      WELCOME_INTENT,
      {
        ...sessionAttrs,
        agencyId,
        callId,
        openingReprompted: "true",
        transcript: menuTranscript,
      },
      [speakForEngine(ask, sessionAttrs.voiceEngine)],
    );
  }

  if (callerRequestedHuman(utterance) || activeIntent === REQUEST_HUMAN_INTENT) {
    if (sessionAttrs.enableLiveAgentHandoff !== "false") {
      const humanSpoken = smsChannel
        ? "A team member can follow up if needed. Describe your concern by text, or call this number to speak with someone. For emergencies call 911."
        : transferPrompt(tenant, "HUMAN_REQUEST");
      return closeTransferResponse(
        REQUEST_HUMAN_INTENT,
        utterance || "caller requested a person",
        { ...sessionAttrs, agencyId, callId, classification: REQUEST_HUMAN_INTENT, transcript },
        [smsChannel ? plain(humanSpoken) : speakForEngine(humanSpoken, sessionAttrs.voiceEngine)],
        "HUMAN_REQUEST",
      );
    }
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

  if (!smsChannel) {
    const heard = activeIntent === PUBLIC_WORKS_INTENT ? `${sessionAttrs.transcript ?? ""} ${utterance}` : utterance;
    const city = readCityService(heard);
    if (city?.emergency && (activeIntent === PUBLIC_WORKS_INTENT || activeIntent === FALLBACK_INTENT)) {
      return emergencyClose(deps, event, config, shortName, emergencySpoken, {
        ...sessionAttrs,
        agencyId,
        callId,
        transcript,
      });
    }
    const listed = city?.issueId.startsWith("NC311-") === true;
    if (city && listed && listedReasonReplacesIntent(activeIntent, city.departmentId)) {
      activeIntent = PUBLIC_WORKS_INTENT;
      sessionAttrs.cityDepartment = city.departmentLabel;
      sessionAttrs.cityIssue = city.issueLabel ?? city.issueId;
    } else if (city && activeIntent === PUBLIC_WORKS_INTENT) {
      sessionAttrs.cityDepartment = city.departmentLabel;
      if (city.issueLabel) sessionAttrs.cityIssue = city.issueLabel;
    }
  }

  const taxonomy311 = apply311Dialog(event, activeIntent, currentSlots, sessionAttrs);
  if (taxonomy311) return taxonomy311;

  // Context extract for non-311 paths / after apply311 mutated slots in place.
  currentSlots = extractSlotsFromContext(
    activeIntent,
    `${sessionAttrs.transcript ?? ""} ${utterance}`,
    currentSlots,
    sessionAttrs,
  );

  const slotMap = extractCurrentSlots(event);
  const identity = ingestConnectCallerIdentity({
    ani: sessionAttrs.ani ?? sessionAttrs.ANI,
    attributes: sessionAttrs,
  });
  const priorSession =
    agencyId && callId ? await deps.getSession(agencyId, callId).catch(() => null) : null;
  const voiceSessionId = sessionAttrs.voiceSessionId?.trim();
  const linkedSession =
    voiceSessionId && agencyId && voiceSessionId !== callId
      ? await deps.getSession(agencyId, voiceSessionId).catch(() => null)
      : null;
  const linkedIntake = linkedSession?.agencyId === agencyId ? linkedSession.intake : undefined;
  const priorIntake = intakeFromCallerIdentity(identity, {
    ...(linkedIntake ?? {}),
    ...(priorSession?.intake ?? {}),
  });
  if (!priorIntake.locationText && sessionAttrs.locationText?.trim()) {
    priorIntake.locationText = sessionAttrs.locationText.trim();
  }
  if (priorIntake.injuries === undefined && sessionAttrs.injuriesReported === "false") priorIntake.injuries = false;
  if (priorIntake.injuries === undefined && sessionAttrs.injuriesReported === "true") priorIntake.injuries = true;
  const memory = applyConversationTurn({
    prior: {
      ...priorIntake,
      language: priorIntake.language ?? language,
      preferredLanguage: priorIntake.preferredLanguage ?? language,
    },
    utterance,
    slotMap,
  });
  let intake = memory.intake;
  if (!intake.preferredLanguage) {
    intake.preferredLanguage = language;
    intake.language = language;
  }
  const correctionAck = spokenCorrectionAck(memory.correctedFields, intake);
  const endpointing = applyAdaptiveEndpointing({
    utterance,
    hadCorrectionCue: memory.hadCorrectionCue,
    sentiment: sessionAttrs.sentiment,
    bargeInCount: Number.parseInt(sessionAttrs.bargeInCount ?? "0", 10) || 0,
    waitingForFinalValue: readEndpointingState(sessionAttrs).waitingForFinalValue,
  });

  const decision = evaluateConfidenceDecision({
    score: effectiveScore,
    source: confidenceSource,
    thresholds,
  });

  // SMS 311 intake: never abandon mid-report for low Lex confidence — keep eliciting.
  const is311Intent = Boolean(LEX_311_INTENT_MAP[activeIntent]);
  const surgeKeepsReport = surgeCompletesInsteadOfTransfer({
    surgeMode: tenant.surgeMode === true,
    reason: "LOW_CONFIDENCE",
  });
  const cityServiceKeepsReport = activeIntent === PUBLIC_WORKS_INTENT;
  const escalateForConfidence =
    decision.action === "escalate_human" &&
    !(smsChannel && is311Intent) &&
    !surgeKeepsReport &&
    !cityServiceKeepsReport;

  if ((escalateForConfidence || activeIntent === FALLBACK_INTENT) && !surgeKeepsReport) {
    await persistTurn(deps, agencyId, callId, {
      decision,
      utterance,
      intake,
      transferred: true,
      qaLowConfidence: true,
    });
    const fallbackSpoken = smsChannel
      ? "I didn't quite catch that. Try a short description (pothole, trash, noise) or reply HELP for options. For emergencies call 911."
      : transferPrompt(tenant, "LOW_CONFIDENCE");
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
      [smsChannel ? plain(fallbackSpoken) : speakForEngine(fallbackSpoken, sessionAttrs.voiceEngine)],
      "LOW_CONFIDENCE",
    );
  }

  const prompted = sessionAttrs.promptSlot;
  const interrupted = detectBargeIn(sessionAttrs, utterance, {
    promptedSlotFilled: Boolean(prompted && slotFilled(currentSlots[prompted])),
  });
  capturePromptedSlot(currentSlots, prompted, utterance);
  intake = mergeIntakeFromLexSlots(extractCurrentSlots(event), intake);
  let missingSlotId = nextMissingSlot(activeIntent, currentSlots, taxonomy, intake);
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
    knownFacts: knownFactLines(intake).join(" | ").slice(0, 900),
    ttyMode: tty.ttyMode ? "1" : "0",
    smsFallbackRecommended: tty.smsFallbackRecommended ? "1" : "0",
    ...bargeInSessionPatch(barge),
    ...conversationMemorySessionPatch(memory),
    ...endpointing.sessionPatch,
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
      bargeInterrupted: interrupted,
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
      return closeTransferResponse(
        FALLBACK_INTENT,
        utterance,
        updatedAttrs,
        [speakForEngine(kb.spoken, sessionAttrs.voiceEngine)],
        "LOW_CONFIDENCE",
      );
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
    const next =
      getNextElicitation(activeIntent, currentSlots, transcript, language) ??
      ({
        slotToElicit: missingSlotId,
        question: humanQuestionForSlot(activeIntent, missingSlotId, language),
      } as const);
    const spokenBase = tty.ttyMode ? formatTtySms(next.question) : next.question;
    const readback =
      !tty.ttyMode && isLocationSlot(prompted)
        ? locationReadback(slotInterpretedValue(currentSlots[prompted ?? ""]))
        : null;
    const spoken = [!tty.ttyMode ? correctionAck : "", readback, spokenBase].filter(Boolean).join(" ");
    if (tty.smsFallbackRecommended) updatedAttrs.ttySmsScript = formatTtySms(next.question);
    updatedAttrs.promptSlot = next.slotToElicit;
    const slotMessage = tty.ttyMode ? plain(spoken) : plain(spoken);
    const messages = greetingPrefix ? [plain(greetingPrefix), slotMessage] : [slotMessage];
    return elicitSlotResponse(activeIntent, next.slotToElicit, currentSlots, updatedAttrs, messages);
  }

  if (activeIntent === REPEAT_CALL_INTENT) {
    const next = getNextElicitation(activeIntent, currentSlots, transcript, language);
    if (next) {
      updatedAttrs.promptSlot = next.slotToElicit;
      return elicitSlotResponse(activeIntent, next.slotToElicit, currentSlots, updatedAttrs, [
        plain(next.question),
      ]);
    }
    return delegateResponse(activeIntent, currentSlots, updatedAttrs, true);
  }

  const nextBeforeDelegate = getNextElicitation(activeIntent, currentSlots, transcript, language);
  if (nextBeforeDelegate) {
    updatedAttrs.promptSlot = nextBeforeDelegate.slotToElicit;
    return elicitSlotResponse(
      activeIntent,
      nextBeforeDelegate.slotToElicit,
      currentSlots,
      updatedAttrs,
      [plain(nextBeforeDelegate.question)],
    );
  }

  const place = filledLocation(currentSlots);
  if (!smsChannel && place && sessionAttrs.locationConfirmed !== "true") {
    const readback = locationReadback(place, language);
    if (readback) {
      updatedAttrs.awaitingLocationConfirm = "true";
      updatedAttrs.pendingLocation = place;
      updatedAttrs.promptSlot = "LOCATION_CONFIRM";
      return elicitIntentResponse(activeIntent, updatedAttrs, [plain(readback)]);
    }
  }

  const confirmationState = event.sessionState.intent.confirmationState ?? "None";
  const is311 = Boolean(LEX_311_INTENT_MAP[activeIntent]);
  const needsConfirm = is311 || LEX_SPEC_CONFIRMATION_INTENTS.has(activeIntent);

  if (needsConfirm && confirmationState !== "Confirmed" && confirmationState !== "Denied") {
    let confirmText = humanConfirmationQuestion(activeIntent, currentSlots);
    if (deps.listRecentSessions && place && intake.callbackNumber) {
      const rows = await deps.listRecentSessions(agencyId).catch(() => []);
      const duplicate = findSameDayReport(rows, {
        sessionId: callId,
        now,
        callbackNumber: intake.callbackNumber,
        locationText: place,
      });
      if (duplicate) {
        confirmText += " I already have a report for this place from this number today. Say YES only if this is a new problem.";
      }
    }
    updatedAttrs.promptSlot = "CONFIRM_INTENT";
    return confirmIntentResponse(activeIntent, currentSlots, updatedAttrs, [plain(confirmText)]);
  }

  if (confirmationState === "Denied") {
    const restart = getNextElicitation(activeIntent, {}, transcript, language);
    if (restart) {
      return elicitSlotResponse(activeIntent, restart.slotToElicit, {}, updatedAttrs, [
        plain("No problem — let's update that. " + restart.question),
      ]);
    }
  }

  return delegateResponse(activeIntent, currentSlots, updatedAttrs, true);
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
    bargeInterrupted?: boolean;
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

  if (opts.bargeInterrupted) {
    try {
      await bargeAuditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: "lex-dialog-hook",
        type: AUDIT_EVENT_TYPES.CALL_ASSIST_BARGE_IN,
        details: {
          bargeInCount: opts.bargeInCount ?? 0,
          lastBargeInAt: opts.lastBargeInAt,
          utterancePreview: opts.utterance.slice(0, 80),
        },
        createdAt: opts.lastBargeInAt ?? new Date().toISOString(),
        resourceType: "session",
        resourceId: callId,
      });
    } catch {
      /* audit must never abort dialog */
    }
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
    config,
    event.bot?.localeId ?? sessionAttrs.locale,
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
  config: CallAssistTenantConfig | null = null,
  locale = "en-US",
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
  const parts = escalationCloseParts(config, locale, { ...sessionAttrs, agencyId, callId, classification: EMERGENCY_INTENT, transcript }, spoken, sessionAttrs.transcript ?? utterance);
  return closeTransferResponse(
    EMERGENCY_INTENT,
    summary,
    parts.sessionAttributes,
    parts.messages,
    "EMERGENCY",
    { endSession: parts.endSession },
  );
}

function filledLocation(slots: Record<string, LexSlotValue | null>): string {
  for (const [name, slot] of Object.entries(slots)) {
    if (!isLocationSlot(name)) continue;
    const value = slotInterpretedValue(slot);
    if (value) return value;
  }
  return "";
}

function slotInterpretedValue(slot: LexSlotValue | null | undefined): string {
  return slot?.value?.interpretedValue?.trim() || slot?.value?.originalValue?.trim() || "";
}

export function humanConfirmationQuestion(
  intentName: string,
  slots: Record<string, LexSlotValue | null>,
): string {
  if (intentName === PUBLIC_WORKS_INTENT) {
    const where = slotInterpretedValue(slots.PublicWorksLocation);
    const issue = slotInterpretedValue(slots.PublicWorksIssueType);
    const city = readCityService(`${issue} ${where}`);
    const department = city?.departmentLabel ?? "Public Works";
    const issueBit = issue ? ` a ${issue}` : " this";
    const whereBit = where ? ` at ${where}` : "";
    return `I can log${issueBit}${whereBit} with ${department}. Reply YES to submit, or NO to change something.`;
  }
  const intentDef = LEX_311_INTENT_MAP[intentName];
  const address = slotInterpretedValue(slots.ServiceAddress) || slotInterpretedValue(slots.location);
  const subIssueSlot = intentDef?.slots.find(
    (s) => s.slotTypeName.includes("SubIssue") || s.name.toLowerCase().includes("subissue"),
  );
  const subIssue = conversationalSlotValue(
    subIssueSlot ? slotInterpretedValue(slots[subIssueSlot.name]) : "",
  );
  const department = conversationalSlotValue(intentDef?.primaryDepartment) || "the city";
  const article = /^[aeiou]/i.test(subIssue) ? "an" : "a";
  const issueBit = subIssue ? ` ${article} ${subIssue}` : " this";
  const whereBit = address ? ` at ${address}` : "";
  return `I can log${issueBit}${whereBit} with ${department}. Reply YES to submit, or NO to change something.`;
}

export function nextMissingSlot(
  intentId: string,
  currentSlots: Record<string, LexSlotValue | null>,
  taxonomy: AgencyTaxonomy,
  intake?: CallIntakeData,
): string | null {
  const taxonomy311Slots = LEX_311_INTENT_MAP[intentId]?.slots;
  if (taxonomy311Slots?.length) {
    for (const slot of taxonomy311Slots) {
      if (!slot.isRequired) continue;
      if (slotFilled(currentSlots[slot.name])) continue;
      if (intake?.locationText?.trim() && isLocationSlot(slot.name)) continue;
      return slot.name;
    }
    return null;
  }
  const specSlots = LEX_SPEC_SLOTS[intentId];
  const usesLegacyLocation = "location" in currentSlots;
  const usesSpecKeys = Boolean(specSlots?.some((slot) => slot.name in currentSlots));
  if (specSlots && specSlots.length > 0 && (usesSpecKeys || !usesLegacyLocation)) {
    for (const slot of specSlots) {
      if (!slot.required) continue;
      if (slotFilled(currentSlots[slot.name])) continue;
      if (intake && isVehicleDescriptionSlot(slot.name) && vehicleDescriptionSatisfied(intake)) continue;
      if (intake?.locationText?.trim() && isLocationSlot(slot.name)) continue;
      return slot.name;
    }
    return null;
  }

  const callType = findCallTypeForIntent(taxonomy, intentId);
  if (!callType) {
    if (!slotFilled(currentSlots.location) && "location" in currentSlots && !intake?.locationText?.trim()) {
      return "location";
    }
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
    if (
      (field === "vehicleMake" || field === "vehicleModel" || field === "vehicleColor") &&
      vehicleDescriptionSatisfied(intake)
    ) {
      continue;
    }
    if (field === "vehiclePlate" && (intake.vehicleUnknown || Boolean(intake.vehiclePlate?.trim()))) {
      continue;
    }
    const current = intake[field];
    if (typeof current === "boolean" ? true : Boolean(current && String(current).trim())) continue;
    return slot.name;
  }
  return null;
}
