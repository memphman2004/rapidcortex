import {
  resolveAgencyTaxonomy,
  type AgencyTaxonomy,
} from "rapid-cortex-shared";
import type { CallAssistTenantConfig } from "../store.js";
import { classifyWithBedrock, findCallTypeForIntent } from "./intent-classifier.js";
import { agencyShortName, slotPrompt, transferPrompt } from "./prompts.js";
import { handleFulfillment } from "./fulfillment-hook.js";
import { getLexSession, getLexTenantConfig, updateLexSession } from "./runtime-store.js";
import { buildTransferSummary, runSafetyGate } from "./safety-gate.js";
import { extractCurrentSlots, slotFilled } from "./slot-extractor.js";
import type { LexMessage, LexSlotValue, LexV2Event, LexV2Response } from "./types.js";

export const EMERGENCY_INTENT = "EmergencyEscalation";
export const FALLBACK_INTENT = "FallbackIntent";
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

  if (utterance) {
    const safety = runSafetyGate(utterance);
    if (safety.isEmergency) {
      let shortName = "Call Assist";
      let config: CallAssistTenantConfig | null = null;
      try {
        if (agencyId) config = await deps.getConfig(agencyId);
        if (config) shortName = agencyShortName(config);
      } catch {
        /* transfer anyway */
      }
      const slots = extractCurrentSlots(event);
      const summary = buildTransferSummary(utterance, slots, shortName);
      try {
        await deps.updateSession(agencyId, callId, {
          state: "TRANSFERRING_911",
          continueAiConversation: false,
        });
      } catch {
        /* transfer anyway */
      }
      const spoken = config
        ? transferPrompt(config, "EMERGENCY")
        : "I'm connecting you to a dispatcher right now. Please stay on the line.";
      const transcript = [...(sessionAttrs.transcript ?? "").split("|").filter(Boolean), `Caller: ${utterance}`].join(
        "|",
      );
      return transferResponse(
        EMERGENCY_INTENT,
        summary,
        { ...sessionAttrs, agencyId, callId, classification: EMERGENCY_INTENT, transcript },
        [ssml(spoken)],
      );
    }
  }

  const config = agencyId
    ? await deps.getConfig(agencyId)
    : await deps.getConfig("unknown");
  const taxonomy = resolveAgencyTaxonomy(config);

  const topInterpretation = event.interpretations?.[0];
  const lexConfidence = topInterpretation?.nluConfidence ?? 0;
  const lexIntent = event.sessionState.intent.name;
  let activeIntent = lexIntent;

  if (lexConfidence < MIN_LEX_CONFIDENCE || lexIntent === FALLBACK_INTENT) {
    const history = (sessionAttrs.transcript ?? "").split("|").filter(Boolean);
    const bedrockResult = await deps.classify(utterance, history, taxonomy);
    if (bedrockResult.confidence >= MIN_LEX_CONFIDENCE && bedrockResult.intentName !== FALLBACK_INTENT) {
      activeIntent = bedrockResult.intentName;
    } else {
      return transferResponse(FALLBACK_INTENT, utterance, sessionAttrs, [
        ssml(transferPrompt(config, "LOW_CONFIDENCE")),
      ]);
    }
  }

  const transcript = [...(sessionAttrs.transcript ?? "").split("|").filter(Boolean), `Caller: ${utterance}`].join(
    "|",
  );
  const updatedAttrs: Record<string, string> = {
    ...sessionAttrs,
    agencyId,
    callId,
    classification: activeIntent,
    confidence: String(lexConfidence),
    transcript,
  };

  const currentSlots = event.sessionState.intent.slots ?? {};
  const missingSlotId = nextMissingSlot(activeIntent, currentSlots, taxonomy);
  if (missingSlotId) {
    return elicitSlotResponse(activeIntent, missingSlotId, currentSlots, updatedAttrs, [
      plain(slotPrompt(config, missingSlotId)),
    ]);
  }

  return delegateResponse(activeIntent, currentSlots, updatedAttrs);
}

export function nextMissingSlot(
  intentId: string,
  currentSlots: Record<string, LexSlotValue | null>,
  taxonomy: AgencyTaxonomy,
): string | null {
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

function elicitSlotResponse(
  name: string,
  slotToElicit: string,
  slots: Record<string, LexSlotValue | null>,
  sessionAttributes: Record<string, string>,
  messages: LexMessage[],
): LexV2Response {
  return {
    sessionState: {
      sessionAttributes,
      dialogAction: { type: "ElicitSlot", slotToElicit },
      intent: { name, slots, state: "InProgress" },
    },
    messages,
  };
}

function delegateResponse(
  name: string,
  slots: Record<string, LexSlotValue | null>,
  sessionAttributes: Record<string, string>,
): LexV2Response {
  return {
    sessionState: {
      sessionAttributes,
      dialogAction: { type: "Delegate" },
      intent: { name, slots, state: "ReadyForFulfillment" },
    },
  };
}

function transferResponse(
  intentName: string,
  summary: string,
  sessionAttributes: Record<string, string>,
  messages: LexMessage[],
): LexV2Response {
  return {
    sessionState: {
      sessionAttributes: {
        ...sessionAttributes,
        transferSummary: summary,
        transferReason: intentName === EMERGENCY_INTENT ? "EMERGENCY" : "LOW_CONFIDENCE",
      },
      dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
      intent: { name: intentName, state: "Fulfilled" },
    },
    messages,
  };
}

function ssml(text: string): LexMessage {
  return { contentType: "SSML", content: `<speak>${text}</speak>` };
}

function plain(text: string): LexMessage {
  return { contentType: "PlainText", content: text };
}
