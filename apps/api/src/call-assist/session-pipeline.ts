import {
  buildTransferPackage,
  callTakerConfidenceRows,
  callerRequestedHuman,
  callAssistVoiceVarsFromTenant,
  classifyCallTriage,
  detectCallAssistLanguage,
  detectTtyMode,
  evaluateCarfaxEligibility,
  evaluateConfidenceDecision,
  evaluateSafety,
  extractIntakeFields,
  EMERGENCY_TRANSFER_ACTION,
  findCallType,
  formatTtySms,
  interpolateCallAssistVoice,
  isImmutableEmergency,
  nextIntakeQuestion,
  normalizePreferredLanguage,
  recommendRoute,
  recordAskedQuestion,
  resolveAgencyTaxonomy,
  resolveGreetingConfig,
  checkEscalation,
  buildGreeting,
  isCallAssistGreetingReady,
  groundedKnowledgeReply,
  spokenIntakePrompt,
  topKnowledgeHit,
  mergeVoiceDistressIntoSafety,
  withExternalRouteDefaults,
  evaluateExternalRoute,
  mapConnectParticipantRole,
  mapTranscribeSpeakerLabel,
  type CallAssistMode,
  type CallAssistSource,
  type CallAssistSpeaker,
  type CallAssistSentiment,
  type CallIntakeData,
  type KnowledgeArticleLike,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { aniLast4, hashAni, locationKey } from "./identity.js";
import { callAssistStore, type CallAssistSessionRecord } from "./store.js";
import { getOrCreateConfig, isWithinOperatingHours } from "./config-service.js";
import { applyCallAssistCampaigns } from "./campaign-hooks.js";
import { resolveCadProvider } from "./cad/resolve-provider.js";
import { AmazonConnectProvider } from "./telephony/amazon-connect.js";
import { ingestConnectCallerIdentity, intakeFromCallerIdentity } from "./telephony/ani-ali.js";
import { lookupRapidSosLocation } from "./rapidsos/adapter.js";
import { enrichIntakeWithGis } from "./gis-enrichment.js";
import { analyzeCallAssistSentiment, analyzeVoiceEmotion } from "./voice-emotion.js";
import { closeOpenTransferAttempts, recordTransferAttempt } from "./transfer-ledger.js";

const auditRepo = new AuditRepository();
const telephony = new AmazonConnectProvider();

async function audit(
  agencyId: string,
  actorId: string,
  type: string,
  details: Record<string, unknown>,
  resourceId?: string,
): Promise<void> {
  await auditRepo.create({
    eventId: makeId("audit"),
    agencyId,
    actorId,
    type,
    details,
    createdAt: new Date().toISOString(),
    resourceType: "session",
    resourceId,
  });
}

async function mockOrInitiated(demo: boolean): Promise<"ANSWERED" | "INITIATED"> {
  return demo || env.callAssistConnectMock ? "ANSWERED" : "INITIATED";
}

export async function initiateSession(opts: {
  agencyId: string;
  actorId: string;
  mode?: CallAssistMode;
  source?: CallAssistSource;
  ani?: string;
  language?: string;
  ttyMode?: boolean;
  connectContactId?: string;
  connectAttributes?: Record<string, string>;
  mediaType?: string;
}): Promise<CallAssistSessionRecord> {
  const config = await getOrCreateConfig(opts.agencyId);
  const shift = await callAssistStore.getShift(opts.agencyId);
  const now = new Date().toISOString();
  const tty = detectTtyMode({
    connectAttributes: opts.connectAttributes,
    mediaType: opts.mediaType,
    manualTty: opts.ttyMode,
  });
  const identity = ingestConnectCallerIdentity({ ani: opts.ani, attributes: opts.connectAttributes });
  const ani = identity.ani ?? opts.ani;
  const preferred = normalizePreferredLanguage(opts.language);
  const intake = {
    ...intakeFromCallerIdentity(identity),
    language: preferred !== "und" ? preferred : opts.language,
    preferredLanguage: preferred !== "und" ? preferred : undefined,
  };
  const greeting = resolveGreetingConfig(config);
  const greetingReady = isCallAssistGreetingReady(greeting);
  const openingText = greetingReady
    ? buildGreeting(greeting, preferred !== "und" ? preferred : opts.language ?? "en-US")
    : interpolateCallAssistVoice(config.disclosureText, callAssistVoiceVarsFromTenant(config));
  const session: CallAssistSessionRecord = {
    agencyId: opts.agencyId,
    sessionId: makeId("cas"),
    state: "DISCLOSURE",
    mode: opts.mode ?? "NON_EMERGENCY",
    source: opts.source ?? "LIVE",
    aniHash: hashAni(ani),
    aniLast4: aniLast4(ani),
    language: preferred !== "und" ? preferred : opts.language ?? "und",
    ttyMode: tty.ttyMode,
    smsFallbackRecommended: tty.smsFallbackRecommended,
    ttySource: tty.source,
    connectContactId: opts.connectContactId,
    disclosureDelivered: config.disclosureEnabled,
    utterances: config.disclosureEnabled
      ? [{ sequence: 0, speaker: "assistant", text: openingText, at: now }]
      : [],
    intake,
    aliAddress: identity.aliAddress,
    continueAiConversation: true,
    legalHold: false,
    shiftLabel: shift?.currentShift ?? config.shiftLabel,
    createdAt: now,
    updatedAt: now,
  };
  await callAssistStore.putSession(session);
  await audit(opts.agencyId, opts.actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_SESSION_STARTED, {
    source: session.source,
    ttyMode: session.ttyMode,
  }, session.sessionId);
  if (config.disclosureEnabled) {
    await audit(opts.agencyId, opts.actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_DISCLOSURE_DELIVERED, {}, session.sessionId);
  }
  return session;
}

export type UtteranceResult = {
  session: CallAssistSessionRecord;
  telephony?: Awaited<ReturnType<AmazonConnectProvider["emergencyTransfer"]>>;
};

export async function processUtterance(opts: {
  agencyId: string;
  actorId: string;
  sessionId: string;
  text: string;
  speaker?: CallAssistSpeaker;
  speakerId?: string;
  participantRole?: string;
  contactLensTone?: string;
  lexSentiment?: CallAssistSentiment | null;
}): Promise<UtteranceResult> {
  const session = await callAssistStore.getSession(opts.agencyId, opts.sessionId);
  if (!session) {
    const err = new Error("SESSION_NOT_FOUND");
    throw err;
  }
  if (session.agencyId !== opts.agencyId) {
    throw new Error("SESSION_NOT_FOUND");
  }

  const now = new Date().toISOString();
  let speaker: CallAssistSpeaker = opts.speaker ?? "caller";
  let speakerId = opts.speakerId;
  let channel: "CUSTOMER" | "AGENT" | "UNKNOWN" | undefined;
  if (env.enableCallAssistDiarization) {
    if (opts.participantRole) {
      const mapped = mapConnectParticipantRole(opts.participantRole);
      speaker = mapped.speaker;
      speakerId = mapped.speakerId;
      channel = mapped.channel;
    } else if (opts.speakerId) {
      const mapped = mapTranscribeSpeakerLabel(opts.speakerId);
      speaker = mapped.speaker;
      speakerId = mapped.speakerId;
    }
  }
  session.utterances = [
    ...session.utterances,
    {
      sequence: session.utterances.length,
      speaker,
      text: opts.text,
      at: now,
      ...(speakerId ? { speakerId } : {}),
      ...(channel ? { channel } : {}),
    },
  ];

  if (speaker !== "caller") {
    session.updatedAt = now;
    await callAssistStore.putSession(session);
    return { session };
  }

  const config = await getOrCreateConfig(opts.agencyId);
  const taxonomy = resolveAgencyTaxonomy(config);
  let safety = evaluateSafety(opts.text);
  if (env.enableCallAssistVoiceEmotion) {
    const sentiment = await analyzeCallAssistSentiment({ text: opts.text, lex: opts.lexSentiment });
    const emotion = await analyzeVoiceEmotion({
      text: opts.text,
      lexSentiment: sentiment,
      contactLensTone: opts.contactLensTone,
    });
    session.sentiment = sentiment;
    session.voiceEmotion = emotion;
    safety = mergeVoiceDistressIntoSafety(safety, emotion);
  }
  session.safety = safety;
  const lang = detectCallAssistLanguage(opts.text);
  if (lang !== "und") {
    session.language = lang;
    session.intake = {
      ...session.intake,
      language: lang,
      preferredLanguage: lang,
    };
  }

  if (isImmutableEmergency(safety)) {
    session.triage = classifyCallTriage(opts.text, {
      prior: session.triage?.primaryClassification,
      taxonomy,
      confidenceThresholds: config.confidenceThresholds,
    });
    session.state = "TRANSFERRING_911";
    session.continueAiConversation = false;
    session.nextQuestion = undefined;
    const routing = recommendRoute({
      classification: session.triage.primaryClassification,
      externalAgencies: [],
      intakeSummary: session.intake.summary,
      callbackNumber: session.intake.callbackNumber,
      locationText: session.intake.locationText,
      taxonomy,
    });
    session.routing = routing;
    session.transfer = buildTransferPackage({
      sessionId: session.sessionId,
      agencyId: session.agencyId,
      triage: session.triage,
      safety,
      intake: session.intake,
      routing,
      utterances: session.utterances.map((u) => u.text),
      ttyMode: session.ttyMode,
      language: session.language,
    });
    const escalation = checkEscalation(opts.text, resolveGreetingConfig(config), session.language ?? "en-US");
    const tel =
      escalation.action === "announce_and_end"
        ? { action: "CONTINUE" as const, spokenCallerScript: escalation.announcement, continueAiConversation: false }
        : await telephony.emergencyTransfer(
            {
              liveEmergencyNumber: config.emergencyDestination,
              demoEmergencyNumber: config.demoEmergencyDestination,
            },
            { demo: session.source === "DEMO", spokenCallerScript: escalation.announcement },
          );
    session.updatedAt = now;
    const xfer = await recordTransferAttempt({
      agencyId: opts.agencyId,
      sessionId: session.sessionId,
      actorId: opts.actorId,
      destinationType: "EMERGENCY_911",
      destinationId: "emergency-911",
      destinationDisplay: "Emergency 911",
      channel: "QUEUE",
      outcome: await mockOrInitiated(session.source === "DEMO"),
    });
    session.lastTransferOutcome = xfer.outcome;
    await callAssistStore.putSession(session);
    await audit(
      opts.agencyId,
      opts.actorId,
      AUDIT_EVENT_TYPES.CALL_ASSIST_EMERGENCY_TRANSFER,
      {
        action: EMERGENCY_TRANSFER_ACTION,
        continueAiConversation: false,
        demo: session.source === "DEMO",
        destination: tel.destinationNumber,
        triggers: safety.triggers,
      },
      session.sessionId,
    );
    return { session, telephony: tel };
  }

  if (callerRequestedHuman(opts.text)) {
    session.state = "TRANSFERRING_HUMAN";
    session.continueAiConversation = false;
    session.triage = classifyCallTriage(opts.text, {
      prior: session.triage?.primaryClassification,
      taxonomy,
      confidenceThresholds: config.confidenceThresholds,
    });
    const routing = recommendRoute({
      classification: session.triage.primaryClassification,
      externalAgencies: await callAssistStore.listExternal(opts.agencyId),
      intakeSummary: session.intake.summary,
      callbackNumber: session.intake.callbackNumber,
      locationText: session.intake.locationText,
      taxonomy,
    });
    routing.destinationType = "CALL_TAKER";
    routing.spokenCallerScript = "I'll connect you with a call taker now.";
    session.routing = routing;
    session.updatedAt = now;
    await callAssistStore.putSession(session);
    const humanXfer = await recordTransferAttempt({
      agencyId: opts.agencyId,
      sessionId: session.sessionId,
      actorId: opts.actorId,
      destinationType: "CALL_TAKER",
      destinationId: "queue-call-taker",
      destinationDisplay: "Live call taker",
      channel: "QUEUE",
      outcome: session.source === "DEMO" || env.callAssistConnectMock ? "ANSWERED" : "INITIATED",
    });
    session.lastTransferOutcome = humanXfer.outcome;
    await callAssistStore.putSession(session);
    await audit(opts.agencyId, opts.actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_HUMAN_TRANSFER, {}, session.sessionId);
    return { session };
  }

  session.intake = extractIntakeFields(opts.text, session.intake);
  if (session.intake.locationText?.trim()) {
    session.intake = await enrichIntakeWithGis({
      intake: session.intake,
      zones: config.gisZones,
      tenantCity: config.tenantCity,
      tenantState: config.tenantState,
    });
  }
  const articles = await callAssistStore.listKnowledge(opts.agencyId);
  const kbHit = topKnowledgeHit(opts.text, articles as KnowledgeArticleLike[]);
  session.knowledgeHit = Boolean(kbHit);
  session.knowledgeArticleId = kbHit?.articleId;
  session.knowledgeExcerpt = kbHit?.excerpt;
  const rapid = await lookupRapidSosLocation({
    agencyId: opts.agencyId,
    mock: env.callAssistRapidSosMock,
  });
  if (rapid?.lat && rapid.lng && !session.intake.locationLat) {
    session.intake = {
      ...session.intake,
      locationLat: rapid.lat,
      locationLng: rapid.lng,
      locationSource: "RAPIDSOS",
    };
  }

  const loc = locationKey(session.intake.locationText);
  session.locationKey = loc;
  session.intake.summary = session.utterances
    .filter((u) => u.speaker === "caller")
    .map((u) => u.text)
    .join(" ")
    .slice(0, 2000);

  const triage = classifyCallTriage(opts.text, {
    prior: session.triage?.primaryClassification,
    taxonomy,
    confidenceThresholds: config.confidenceThresholds,
  });
  session.triage = triage;
  const matchedType = findCallType(taxonomy, triage.primaryClassification);
  session.cadTypeLabel = matchedType?.label;
  session.cadNatureCode =
    matchedType?.cadNatureCode ?? config.cadNatureMapping[triage.primaryClassification] ?? undefined;
  session.cadPriority = matchedType?.defaultPriority;
  const confidence = evaluateConfidenceDecision({
    score: triage.confidence,
    source: "triage",
    thresholds: config.confidenceThresholds,
  });
  session.lastConfidence = confidence.score;
  session.confidenceSource = confidence.source;
  session.confidenceAction = confidence.action;
  session.confidenceBelowThreshold = confidence.belowEscalate;
  const confidenceRows = callTakerConfidenceRows({
    intentScore: confidence.score,
    classificationScore: triage.confidence,
    addressConfidence: session.intake.addressConfidence,
    locationSource: session.intake.locationSource,
    locationText: session.intake.locationText,
    routingDestinationType: session.routing?.destinationType,
    classification: triage.primaryClassification,
    thresholds: config.confidenceThresholds,
  });
  session.intentConfidence = confidenceRows.find((r) => r.id === "intent")?.score;
  session.classificationConfidence = confidenceRows.find((r) => r.id === "classification")?.score;
  session.locationConfidence = confidenceRows.find((r) => r.id === "location")?.score;
  session.routingConfidence = confidenceRows.find((r) => r.id === "routing")?.score;
  if (confidence.belowSelfService) {
    session.qaLowConfidence = true;
    session.lastConfidenceUtterance = opts.text.slice(0, 120);
    await audit(
      opts.agencyId,
      opts.actorId,
      AUDIT_EVENT_TYPES.CALL_ASSIST_LOW_CONFIDENCE,
      {
        score: confidence.score,
        action: confidence.action,
        threshold: confidence.thresholds.escalate,
        selfService: confidence.thresholds.selfService,
        classification: triage.primaryClassification,
        transferred: confidence.action === "escalate_human",
      },
      session.sessionId,
    );
  }

  const infoClass = triage.primaryClassification === "INFORMATION_REQUEST" || triage.matchedCallTypeId === "INFORMATION_REQUEST";
  if (infoClass) {
    const spoken = groundedKnowledgeReply({
      proposedText: kbHit ? `${kbHit.title}. ${kbHit.excerpt}` : "",
      knowledgeHit: Boolean(kbHit),
      requiresKnowledge: true,
    });
    if (!kbHit) {
      await audit(
        opts.agencyId,
        opts.actorId,
        AUDIT_EVENT_TYPES.CALL_ASSIST_KNOWLEDGE_MISS,
        { query: opts.text.slice(0, 120) },
        session.sessionId,
      );
      session.state = "TRANSFERRING_HUMAN";
      session.continueAiConversation = false;
      session.nextQuestion = spoken;
      session.updatedAt = now;
      await callAssistStore.putSession(session);
      await audit(opts.agencyId, opts.actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_HUMAN_TRANSFER, { reason: "ungrounded_information" }, session.sessionId);
      return { session };
    }
    session.utterances = [
      ...session.utterances,
      { sequence: session.utterances.length, speaker: "assistant", text: spoken, at: now },
    ];
  }

  if (confidence.action === "escalate_human" && !triage.emergencyDetected && !infoClass) {
    session.state = "TRANSFERRING_HUMAN";
    session.continueAiConversation = false;
    session.updatedAt = now;
    const lowXfer = await recordTransferAttempt({
      agencyId: opts.agencyId,
      sessionId: session.sessionId,
      actorId: opts.actorId,
      destinationType: "CALL_TAKER",
      destinationId: "queue-call-taker",
      destinationDisplay: "Live call taker",
      channel: "QUEUE",
      outcome: await mockOrInitiated(session.source === "DEMO"),
    });
    session.lastTransferOutcome = lowXfer.outcome;
    await callAssistStore.putSession(session);
    await audit(opts.agencyId, opts.actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_HUMAN_TRANSFER, { reason: "low_confidence" }, session.sessionId);
    return { session };
  }

  if (triage.emergencyDetected) {
    session.state = "TRANSFERRING_911";
    session.continueAiConversation = false;
    session.nextQuestion = undefined;
    const routing = recommendRoute({
      classification: triage.primaryClassification,
      externalAgencies: [],
      intakeSummary: session.intake.summary,
      callbackNumber: session.intake.callbackNumber,
      locationText: session.intake.locationText,
      taxonomy,
    });
    session.routing = routing;
    session.transfer = buildTransferPackage({
      sessionId: session.sessionId,
      agencyId: session.agencyId,
      triage,
      safety,
      intake: session.intake,
      routing,
      utterances: session.utterances.map((u) => u.text),
      ttyMode: session.ttyMode,
      language: session.language,
    });
    const escalation = checkEscalation(opts.text, resolveGreetingConfig(config), session.language ?? "en-US");
    const tel =
      escalation.action === "announce_and_end"
        ? { action: "CONTINUE" as const, spokenCallerScript: escalation.announcement, continueAiConversation: false }
        : await telephony.emergencyTransfer(
            {
              liveEmergencyNumber: config.emergencyDestination,
              demoEmergencyNumber: config.demoEmergencyDestination,
            },
            { demo: session.source === "DEMO", spokenCallerScript: escalation.announcement },
          );
    session.updatedAt = now;
    const xfer911 = await recordTransferAttempt({
      agencyId: opts.agencyId,
      sessionId: session.sessionId,
      actorId: opts.actorId,
      destinationType: "EMERGENCY_911",
      destinationId: "emergency-911",
      destinationDisplay: "Emergency 911",
      channel: "QUEUE",
      outcome: await mockOrInitiated(session.source === "DEMO"),
    });
    session.lastTransferOutcome = xfer911.outcome;
    await callAssistStore.putSession(session);
    await audit(
      opts.agencyId,
      opts.actorId,
      AUDIT_EVENT_TYPES.CALL_ASSIST_EMERGENCY_TRANSFER,
      {
        action: EMERGENCY_TRANSFER_ACTION,
        continueAiConversation: false,
        demo: session.source === "DEMO",
        destination: tel.destinationNumber,
        triggers: ["taxonomy_is_emergency"],
      },
      session.sessionId,
    );
    return { session, telephony: tel };
  }

  const externals = await callAssistStore.listExternal(opts.agencyId);
  const routing = recommendRoute({
    classification: triage.primaryClassification,
    externalAgencies: externals,
    intakeSummary: session.intake.summary,
    callbackNumber: session.intake.callbackNumber,
    locationText: session.intake.locationText,
    taxonomy,
  });
  session.routing = routing;
  const routedConfidence = callTakerConfidenceRows({
    intentScore: confidence.score,
    classificationScore: triage.confidence,
    addressConfidence: session.intake.addressConfidence,
    locationSource: session.intake.locationSource,
    locationText: session.intake.locationText,
    routingDestinationType: routing.destinationType,
    classification: triage.primaryClassification,
    thresholds: config.confidenceThresholds,
  });
  session.intentConfidence = routedConfidence.find((r) => r.id === "intent")?.score;
  session.classificationConfidence = routedConfidence.find((r) => r.id === "classification")?.score;
  session.locationConfidence = routedConfidence.find((r) => r.id === "location")?.score;
  session.routingConfidence = routedConfidence.find((r) => r.id === "routing")?.score;

  const cad = resolveCadProvider(config.cadProviderId, config.cadNatureMapping);
  const hazards = await cad.getPremiseHazards(opts.agencyId, {
    text: session.intake.locationText,
    lat: session.intake.locationLat,
    lng: session.intake.locationLng,
  });
  const nearby = await cad.findNearbyIncidents(opts.agencyId, {
    text: session.intake.locationText,
  });

  let duplicateCadIds = nearby.map((n) => n.cadIncidentId);
  if (loc) {
    const prior = await callAssistStore.listLocationIndex(opts.agencyId, loc);
    duplicateCadIds = [
      ...duplicateCadIds,
      ...prior.filter((p) => p.sessionId !== session.sessionId).map((p) => p.sessionId),
    ];
    const chronic = await callAssistStore.getChronic(opts.agencyId, loc);
    const hitCount = (chronic?.hitCount ?? 0) + 1;
    await callAssistStore.putChronic({
      agencyId: opts.agencyId,
      locationKey: loc,
      hitCount,
      lastSessionId: session.sessionId,
      lastAt: now,
    });
  }
  if (session.aniHash) {
    const prev = await callAssistStore.getCaller(opts.agencyId, session.aniHash);
    await callAssistStore.putCaller({
      agencyId: opts.agencyId,
      aniHash: session.aniHash,
      last4: session.aniLast4,
      callCount: (prev?.callCount ?? 0) + 1,
      lastSessionId: session.sessionId,
      lastAt: now,
    });
  }

  const carfax = evaluateCarfaxEligibility(session.intake, { portalUrl: config.carfaxPortalUrl });
  const question = nextIntakeQuestion(triage.primaryClassification, session.intake, taxonomy, {
    lastUtterance: opts.text,
    askedQuestionIds: session.askedQuestionIds,
    lastQuestionId: session.lastQuestionId,
    language: session.language,
  });
  if (question) {
    session.askedQuestionIds = recordAskedQuestion(session.askedQuestionIds, question.id);
    session.lastQuestionId = question.id;
    const spoken = spokenIntakePrompt(question, session.language);
    session.nextQuestion = session.ttyMode ? formatTtySms(spoken) : spoken;
    if (session.ttyMode || session.smsFallbackRecommended) {
      session.ttySmsScript = formatTtySms(spoken);
    }
  } else {
    session.nextQuestion = undefined;
  }
  session.state = question ? "INTAKE" : routing.destinationType === "EXTERNAL_AGENCY" ? "TRANSFERRING_EXTERNAL" : "TRIAGED";
  session.continueAiConversation = Boolean(question) && triage.continueIntake;

  const callerHistory = session.aniHash
    ? await callAssistStore.getCaller(opts.agencyId, session.aniHash)
    : null;
  const chronic = loc ? await callAssistStore.getChronic(opts.agencyId, loc) : null;
  const uniqueDupes = [...new Set(duplicateCadIds)];
  session.premiseHazards = hazards;
  session.duplicateCadIds = uniqueDupes;
  session.chronicLocation = (chronic?.hitCount ?? 0) >= 3;
  session.repeatCaller = (callerHistory?.callCount ?? 0) >= 3;

  session.transfer = buildTransferPackage({
    sessionId: session.sessionId,
    agencyId: session.agencyId,
    triage,
    safety,
    intake: session.intake,
    routing,
    utterances: session.utterances.map((u) => u.text),
    premiseHazards: hazards,
    duplicateCadIds: uniqueDupes,
    chronicLocation: session.chronicLocation,
    repeatCaller: session.repeatCaller,
    ttyMode: session.ttyMode,
    language: session.language,
  });

  if (
    !question &&
    routing.destinationType === "CALL_TAKER" &&
    (routing.runtimeDisposition === "incomplete_config" || routing.runtimeDisposition === "after_hours")
  ) {
    session.state = "TRANSFERRING_HUMAN";
    session.continueAiConversation = false;
    session.nextQuestion = routing.spokenCallerScript;
    const blocked = await recordTransferAttempt({
      agencyId: opts.agencyId,
      sessionId: session.sessionId,
      actorId: opts.actorId,
      destinationType: "EXTERNAL_AGENCY",
      destinationId: routing.destinationId,
      destinationDisplay: routing.displayName,
      channel: "QUEUE",
      outcome: "CONFIG_BLOCKED",
      failureReason: (routing.configIssues ?? [routing.runtimeDisposition]).join(","),
      fallbackTo: "queue-call-taker",
    });
    session.lastTransferOutcome = blocked.outcome;
  }

  if (routing.destinationType === "EXTERNAL_AGENCY") {
    const destRaw = externals.find((e) => e.externalAgencyId === routing.destinationId);
    if (destRaw) {
      const dest = withExternalRouteDefaults(destRaw);
      const decision = evaluateExternalRoute({
        route: dest,
        classification: triage.primaryClassification,
        at: new Date(now),
      });
      if (decision.disposition === "incomplete_config" || decision.disposition === "after_hours") {
        session.state = "TRANSFERRING_HUMAN";
        session.continueAiConversation = false;
        session.nextQuestion = decision.spokenCallerScript;
        const blocked = await recordTransferAttempt({
          agencyId: opts.agencyId,
          sessionId: session.sessionId,
          actorId: opts.actorId,
          destinationType: "EXTERNAL_AGENCY",
          destinationId: dest.externalAgencyId,
          destinationDisplay: dest.externalAgencyName,
          channel: decision.channel,
          outcome: "CONFIG_BLOCKED",
          failureReason: decision.issues.join(","),
          fallbackTo: "queue-call-taker",
        });
        session.lastTransferOutcome = blocked.outcome;
      } else {
        const number = decision.destinationNumber || dest.phoneNumber;
        const sip = decision.sipUri || dest.sipUri;
        await telephony.warmTransfer({
          destinationNumber: sip || number,
          spokenCallerScript: decision.spokenCallerScript,
          spokenReceiverSummary: session.transfer.spokenReceiverSummary,
        });
        const extXfer = await recordTransferAttempt({
          agencyId: opts.agencyId,
          sessionId: session.sessionId,
          actorId: opts.actorId,
          destinationType: "EXTERNAL_AGENCY",
          destinationId: dest.externalAgencyId,
          destinationDisplay: dest.externalAgencyName,
          channel: decision.channel,
          outcome: await mockOrInitiated(session.source === "DEMO"),
          fallbackTo: dest.fallbackPhoneNumber,
        });
        session.lastTransferOutcome = extXfer.outcome;
        await audit(
          opts.agencyId,
          opts.actorId,
          AUDIT_EVENT_TYPES.CALL_ASSIST_EXTERNAL_TRANSFER,
          {
            destinationId: dest.externalAgencyId,
            channel: decision.channel,
            disposition: decision.disposition,
            sipConfigured: Boolean(sip),
          },
          session.sessionId,
        );
      }
    }
  }

  session.humanTakeover = session.state === "TRANSFERRING_HUMAN" || session.humanTakeover;
  const next = await applyCallAssistCampaigns({
    session,
    config,
    actorId: opts.actorId,
    utterance: opts.text,
    hoursOpen: isWithinOperatingHours(config),
    nowIso: now,
  });

  next.updatedAt = now;
  await callAssistStore.putSession(next);
  await audit(
    opts.agencyId,
    opts.actorId,
    AUDIT_EVENT_TYPES.CALL_ASSIST_UTTERANCE_PROCESSED,
    {
      classification: triage.primaryClassification,
      carfaxEligible: carfax.eligible,
      continueAiConversation: next.continueAiConversation,
    },
    next.sessionId,
  );
  return { session: next };
}

export async function completeSession(agencyId: string, sessionId: string, actorId: string): Promise<CallAssistSessionRecord> {
  const session = await callAssistStore.getSession(agencyId, sessionId);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  session.state = "COMPLETED";
  session.completedAt = new Date().toISOString();
  session.updatedAt = session.completedAt;
  session.continueAiConversation = false;
  await closeOpenTransferAttempts({
    agencyId,
    sessionId,
    actorId,
    outcome: "COMPLETED",
  });
  await callAssistStore.putSession(session);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_SESSION_COMPLETED, {}, sessionId);
  return session;
}

export function groundedAssistantReply(text: string, knowledgeHit: boolean, emergency: boolean): string {
  return groundedKnowledgeReply({
    proposedText: text,
    knowledgeHit,
    isEmergencyTransfer: emergency,
  });
}

export type { CallIntakeData };
