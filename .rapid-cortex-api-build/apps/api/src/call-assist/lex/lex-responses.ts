import type { LexMessage, LexSlotValue, LexV2Response } from "./types.js";
import { EMERGENCY_INTENT, type TransferReason } from "./dialog-intercept.js";

export function elicitIntentResponse(
  name: string,
  sessionAttributes: Record<string, string>,
  messages: LexMessage[],
): LexV2Response {
  return {
    sessionState: {
      sessionAttributes,
      dialogAction: { type: "ElicitIntent" },
      intent: { name, state: "Fulfilled" },
    },
    messages,
  };
}
export function elicitSlotResponse(
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

export function delegateResponse(
  name: string,
  slots: Record<string, LexSlotValue | null>,
  sessionAttributes: Record<string, string>,
  readyForFulfillment: boolean,
): LexV2Response {
  return {
    sessionState: {
      sessionAttributes,
      dialogAction: { type: "Delegate" },
      intent: {
        name,
        slots,
        state: readyForFulfillment ? "ReadyForFulfillment" : "InProgress",
      },
    },
  };
}

export function closeTransferResponse(
  intentName: string,
  summary: string,
  sessionAttributes: Record<string, string>,
  messages: LexMessage[],
  transferReason: TransferReason,
  opts?: { endSession?: boolean },
): LexV2Response {
  const emergency = transferReason === "EMERGENCY" || transferReason === "INJURY_PRIORITY";
  const endSession = Boolean(opts?.endSession);
  return {
    sessionState: {
      sessionAttributes: {
        ...sessionAttributes,
        transferSummary: summary,
        transferReason,
        emergency: emergency && !endSession ? "true" : "false",
        endSession: endSession ? "true" : "false",
        escalationTriggered: emergency ? "true" : sessionAttributes.escalationTriggered ?? "false",
        ...(transferReason === "REPEAT_CALL" ? { priorCallFlag: "true" } : {}),
        ...(transferReason === "LOW_CONFIDENCE" ? { fallbackTransfer: "true" } : {}),
      },
      dialogAction: { type: "Close", fulfillmentState: "Fulfilled" },
      intent: { name: intentName, state: "Fulfilled" },
    },
    messages,
  };
}

export function reasonForIntent(intentName: string): TransferReason {
  if (intentName === EMERGENCY_INTENT) return "EMERGENCY";
  if (intentName === "RequestHuman") return "HUMAN_REQUEST";
  if (intentName === "RepeatCallCheck") return "REPEAT_CALL";
  if (intentName === "PublicWorksIssue") return "EXTERNAL_311";
  return "LOW_CONFIDENCE";
}

export function ssml(text: string): LexMessage {
  return { contentType: "SSML", content: `<speak>${text}</speak>` };
}

export function plain(text: string): LexMessage {
  return { contentType: "PlainText", content: text };
}
