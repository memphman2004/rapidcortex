import {
  assertGroundedReply,
  buildTransferPackage,
  callerRequestedHuman,
  callAssistVoiceVarsFromTenant,
  classifyCallTriage,
  detectCallAssistLanguage,
  detectTtyMode,
  evaluateCarfaxEligibility,
  evaluateSafety,
  extractIntakeFields,
  EMERGENCY_TRANSFER_ACTION,
  interpolateCallAssistVoice,
  isImmutableEmergency,
  nextIntakeQuestion,
  recommendRoute,
  resolveAgencyTaxonomy,
  type CallAssistMode,
  type CallAssistSource,
  type CallIntakeData,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { env } from "../lib/env.js";
import { makeId } from "../lib/ids.js";
import { AuditRepository } from "../repositories/auditRepository.js";
import { aniLast4, hashAni, locationKey } from "./identity.js";
import { callAssistStore, type CallAssistSessionRecord } from "./store.js";
import { getOrCreateConfig } from "./config-service.js";
import { resolveCadProvider } from "./cad/resolve-provider.js";
import { AmazonConnectProvider } from "./telephony/amazon-connect.js";
import { lookupRapidSosLocation } from "./rapidsos/adapter.js";

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
  const now = new Date().toISOString();
  const tty = detectTtyMode({
    connectAttributes: opts.connectAttributes,
    mediaType: opts.mediaType,
    manualTty: opts.ttyMode,
  });
  const session: CallAssistSessionRecord = {
    agencyId: opts.agencyId,
    sessionId: makeId("cas"),
    state: "DISCLOSURE",
    mode: opts.mode ?? "NON_EMERGENCY",
    source: opts.source ?? "LIVE",
    aniHash: hashAni(opts.ani),
    aniLast4: aniLast4(opts.ani),
    language: opts.language ?? "und",
    ttyMode: tty.ttyMode,
    connectContactId: opts.connectContactId,
    disclosureDelivered: config.disclosureEnabled,
    utterances: config.disclosureEnabled
      ? [{ sequence: 0, speaker: "assistant", text: interpolateCallAssistVoice(config.disclosureText, callAssistVoiceVarsFromTenant(config)), at: now }]
      : [],
    intake: {},
    continueAiConversation: true,
    legalHold: false,
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
  speaker?: "caller" | "assistant" | "system";
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
  session.utterances = [
    ...session.utterances,
    {
      sequence: session.utterances.length,
      speaker: opts.speaker ?? "caller",
      text: opts.text,
      at: now,
    },
  ];

  if ((opts.speaker ?? "caller") !== "caller") {
    session.updatedAt = now;
    await callAssistStore.putSession(session);
    return { session };
  }

  const config = await getOrCreateConfig(opts.agencyId);
  const taxonomy = resolveAgencyTaxonomy(config);
  const safety = evaluateSafety(opts.text);
  session.safety = safety;
  const lang = detectCallAssistLanguage(opts.text);
  if (lang !== "und") session.language = lang;

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
    const tel = await telephony.emergencyTransfer(
      {
        liveEmergencyNumber: config.emergencyDestination,
        demoEmergencyNumber: config.demoEmergencyDestination,
      },
      { demo: session.source === "DEMO", spokenCallerScript: routing.spokenCallerScript },
    );
    session.updatedAt = now;
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
    await audit(opts.agencyId, opts.actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_HUMAN_TRANSFER, {}, session.sessionId);
    return { session };
  }

  session.intake = extractIntakeFields(opts.text, session.intake);
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
    const tel = await telephony.emergencyTransfer(
      {
        liveEmergencyNumber: config.emergencyDestination,
        demoEmergencyNumber: config.demoEmergencyDestination,
      },
      { demo: session.source === "DEMO", spokenCallerScript: routing.spokenCallerScript },
    );
    session.updatedAt = now;
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
  const question = nextIntakeQuestion(triage.primaryClassification, session.intake, taxonomy);
  session.nextQuestion = question?.prompt;
  session.state = question ? "INTAKE" : routing.destinationType === "EXTERNAL_AGENCY" ? "TRANSFERRING_EXTERNAL" : "TRIAGED";
  session.continueAiConversation = Boolean(question) && triage.continueIntake;

  const callerHistory = session.aniHash
    ? await callAssistStore.getCaller(opts.agencyId, session.aniHash)
    : null;
  const chronic = loc ? await callAssistStore.getChronic(opts.agencyId, loc) : null;

  session.transfer = buildTransferPackage({
    sessionId: session.sessionId,
    agencyId: session.agencyId,
    triage,
    safety,
    intake: session.intake,
    routing,
    utterances: session.utterances.map((u) => u.text),
    premiseHazards: hazards,
    duplicateCadIds,
    chronicLocation: (chronic?.hitCount ?? 0) >= 3,
    repeatCaller: (callerHistory?.callCount ?? 0) >= 3,
    ttyMode: session.ttyMode,
    language: session.language,
  });

  if (routing.destinationType === "EXTERNAL_AGENCY") {
    const dest = externals.find((e) => e.externalAgencyId === routing.destinationId);
    if (dest) {
      await telephony.warmTransfer({
        destinationNumber: dest.phoneNumber,
        spokenCallerScript: routing.spokenCallerScript,
        spokenReceiverSummary: session.transfer.spokenReceiverSummary,
      });
      await audit(
        opts.agencyId,
        opts.actorId,
        AUDIT_EVENT_TYPES.CALL_ASSIST_EXTERNAL_TRANSFER,
        { destinationId: dest.externalAgencyId },
        session.sessionId,
      );
    }
  }

  session.updatedAt = now;
  await callAssistStore.putSession(session);
  await audit(
    opts.agencyId,
    opts.actorId,
    AUDIT_EVENT_TYPES.CALL_ASSIST_UTTERANCE_PROCESSED,
    {
      classification: triage.primaryClassification,
      carfaxEligible: carfax.eligible,
      continueAiConversation: session.continueAiConversation,
    },
    session.sessionId,
  );
  return { session };
}

export async function completeSession(agencyId: string, sessionId: string, actorId: string): Promise<CallAssistSessionRecord> {
  const session = await callAssistStore.getSession(agencyId, sessionId);
  if (!session) throw new Error("SESSION_NOT_FOUND");
  session.state = "COMPLETED";
  session.completedAt = new Date().toISOString();
  session.updatedAt = session.completedAt;
  session.continueAiConversation = false;
  await callAssistStore.putSession(session);
  await audit(agencyId, actorId, AUDIT_EVENT_TYPES.CALL_ASSIST_SESSION_COMPLETED, {}, sessionId);
  return session;
}

export function groundedAssistantReply(text: string, knowledgeHit: boolean, emergency: boolean): string {
  const check = assertGroundedReply({
    proposedText: text,
    knowledgeHit,
    isEmergencyTransfer: emergency,
  });
  if (!check.allowed) {
    return "I don't have that in the department knowledge base. I can connect you with a call taker.";
  }
  return text;
}

export type { CallIntakeData };
