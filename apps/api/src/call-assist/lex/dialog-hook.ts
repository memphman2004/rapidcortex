import {
  callerRequestedHuman,
  resolveAgencyTaxonomy,
  type AgencyTaxonomy,
} from "rapid-cortex-shared";
import type { CallAssistTenantConfig } from "../store.js";
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
import { getLexSession, getLexTenantConfig, updateLexSession } from "./runtime-store.js";
import { buildTransferSummary, runSafetyGate } from "./safety-gate.js";
import { extractCurrentSlots, slotFilled } from "./slot-extractor.js";
import type { LexSlotValue, LexV2Event, LexV2Response } from "./types.js";

export { EMERGENCY_INTENT, FALLBACK_INTENT };
export const MIN_LEX_CONFIDENCE = 0.7;

const IMPLICIT_FILLED = new Set(["incidentType", "concernType", "reportType"]);

export type DialogHookDeps = {
  getConfig: (agencyId: string) => Promise<CallAssistTenantConfig>;
  classify: typeof classifyWithBedrock;
  getSession: typeof getLexSession;
  updateSession: typeof updateLexSession;
};

const defaultDeps: DialogHookDeps = {
  getConfig: getLexTenantConfig,
  classify: classifyWithBedrock,
  getSession: getLexSession,
  updateSession: updateLexSession,
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
  const currentSlots = event.sessionState.intent.slots ?? {};

  const config = agencyId ? await deps.getConfig(agencyId).catch(() => null) : null;
  const shortName = config ? agencyShortName(config) : "Call Assist";

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
    return persistAndCloseEmergency(deps, agencyId, callId, summary, sessionAttrs, emergencySpoken, transcript);
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
  let activeIntent = event.sessionState.intent.name;

  if (callerRequestedHuman(utterance) || activeIntent === REQUEST_HUMAN_INTENT) {
    return closeTransferResponse(
      REQUEST_HUMAN_INTENT,
      utterance || "caller requested a person",
      { ...sessionAttrs, agencyId, callId, classification: REQUEST_HUMAN_INTENT, transcript },
      [ssml(transferPrompt(tenant, "HUMAN_REQUEST"))],
      "HUMAN_REQUEST",
    );
  }

  if (lexConfidence < MIN_LEX_CONFIDENCE || activeIntent === FALLBACK_INTENT) {
    const history = (sessionAttrs.transcript ?? "").split("|").filter(Boolean);
    const bedrockResult = await deps.classify(utterance, history, taxonomy);
    if (bedrockResult.confidence >= MIN_LEX_CONFIDENCE && bedrockResult.intentName !== FALLBACK_INTENT) {
      activeIntent = bedrockResult.intentName;
    } else {
      return closeTransferResponse(FALLBACK_INTENT, utterance, { ...sessionAttrs, agencyId, callId, transcript }, [
        ssml(transferPrompt(tenant, "LOW_CONFIDENCE")),
      ], "LOW_CONFIDENCE");
    }
  }

  const updatedAttrs: Record<string, string> = {
    ...sessionAttrs,
    agencyId,
    callId,
    classification: activeIntent,
    confidence: String(lexConfidence),
    transcript,
    ...(animalThreatIsAggressive(currentSlots) ? { officerPriority: "ELEVATED" } : {}),
  };

  if (activeIntent === REQUEST_HUMAN_INTENT) {
    return closeTransferResponse(
      REQUEST_HUMAN_INTENT,
      utterance,
      updatedAttrs,
      [ssml(transferPrompt(tenant, "HUMAN_REQUEST"))],
      "HUMAN_REQUEST",
    );
  }

  const missingSlotId = nextMissingSlot(activeIntent, currentSlots, taxonomy);
  if (missingSlotId) {
    return elicitSlotResponse(activeIntent, missingSlotId, currentSlots, updatedAttrs, [
      plain(slotPrompt(tenant, missingSlotId, localeId, activeIntent)),
    ]);
  }

  if (activeIntent === REPEAT_CALL_INTENT || activeIntent === PUBLIC_WORKS_INTENT) {
    return delegateResponse(activeIntent, currentSlots, updatedAttrs, true);
  }

  const waitForConfirm = LEX_SPEC_CONFIRMATION_INTENTS.has(activeIntent);
  return delegateResponse(activeIntent, currentSlots, updatedAttrs, !waitForConfirm);
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
): Promise<LexV2Response> {
  try {
    await deps.updateSession(agencyId, callId, {
      state: "TRANSFERRING_911",
      continueAiConversation: false,
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
