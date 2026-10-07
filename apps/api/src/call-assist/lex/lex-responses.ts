import type { LexMessage, LexSlotValue, LexV2Response } from "./types.js";
import { EMERGENCY_INTENT, type TransferReason } from "./dialog-intercept.js";
import { sanitizeSlotsForIntent } from "./taxonomy-311/slot-catalog.js";

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
function slotsForLex(intentName: string, slots: Record<string, LexSlotValue | null>) {
  return sanitizeSlotsForIntent(intentName, slots);
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
      intent: { name, slots: slotsForLex(name, slots), state: "InProgress" },
    },
    messages,
  };
}

export function confirmIntentResponse(
  name: string,
  slots: Record<string, LexSlotValue | null>,
  sessionAttributes: Record<string, string>,
  messages: LexMessage[],
): LexV2Response {
  return {
    sessionState: {
      sessionAttributes,
      dialogAction: { type: "ConfirmIntent" },
      intent: { name, slots: slotsForLex(name, slots), state: "InProgress", confirmationState: "None" },
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
        slots: slotsForLex(name, slots),
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

const LEX_INTERNAL_NAME =
  /\b(Can you tell me more about the )?(IsOngoing|ServiceAddress|TreeSubIssue|RoadsSubIssue|NoiseSubIssue|SanitationSubIssue|WaterSubIssue|VehicleSubIssue|BuildingSubIssue|AnimalSubIssue|GraffitiSubIssue|ParkSubIssue|LawEnforcementSubIssue|FireEMSSubIssue|HomelessSubIssue|EnvironmentalSubIssue|TransitSubIssue|LightingSubIssue|SignsSubIssue|IssueDescription|CallerName|CallbackNumber|VehicleDescription)\??/g;

function citizenFacingText(text: string): string {
  const cleaned = text
    .replace(LEX_INTERNAL_NAME, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
  return cleaned || "Can you share a bit more detail so we can log this correctly?";
}

export function plain(text: string): LexMessage {
  return { contentType: "PlainText", content: citizenFacingText(text) };
}
