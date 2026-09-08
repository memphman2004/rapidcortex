import { makeId } from "../../lib/ids.js";
import type { CallAssistSessionRecord } from "../store.js";
import { getLexTenantConfig, putLexSession } from "./runtime-store.js";
import { buildCadPayload } from "./cad-payload-builder.js";
import { closingPrompt } from "./prompts.js";
import { extractCurrentSlots } from "./slot-extractor.js";
import type { LexV2Event, LexV2Response } from "./types.js";

export async function handleFulfillment(event: LexV2Event): Promise<LexV2Response> {
  const sessionAttrs = { ...(event.sessionState.sessionAttributes ?? {}) };
  const agencyId = sessionAttrs.agencyId ?? "";
  const callId = sessionAttrs.callId ?? event.sessionId;
  const config = await getLexTenantConfig(agencyId || "unknown");
  const slots = extractCurrentSlots(event);
  const caseNumber = `RC-${makeId("case").slice(-8).toUpperCase()}`;
  const classification = sessionAttrs.classification ?? event.sessionState.intent.name;
  const now = new Date().toISOString();

  const cadPayload = buildCadPayload(agencyId, classification, slots, config);
  const session: CallAssistSessionRecord = {
    agencyId,
    sessionId: callId,
    state: "COMPLETED",
    mode: "NON_EMERGENCY",
    source: "LIVE",
    language: sessionAttrs.language ?? "en",
    ttyMode: false,
    connectContactId: callId,
    disclosureDelivered: true,
    utterances: (sessionAttrs.transcript ?? "")
      .split("|")
      .filter(Boolean)
      .map((text, i) => ({ sequence: i, speaker: "caller", text: text.replace(/^Caller:\s*/, ""), at: now })),
    intake: {
      locationText: cadPayload.location ?? undefined,
      callbackNumber: cadPayload.callbackNumber ?? undefined,
      callerName: cadPayload.callerName ?? undefined,
      summary: cadPayload.notes || undefined,
    },
    continueAiConversation: false,
    legalHold: false,
    createdAt: sessionAttrs.callStartedAt ?? now,
    updatedAt: now,
    completedAt: now,
    cadPushStatus: "not_pushed",
    caseNumber,
    cadPayload: { ...cadPayload },
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
