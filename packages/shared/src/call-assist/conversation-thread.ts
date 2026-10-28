import { jurisdictionHint } from "./gis.js";
import type { CallIntakeData } from "./intake.js";
import { checkEmergencyKeywords } from "./nova-sonic.js";

export type ConversationChannel = "voice" | "sms" | "handoff";

/** What this turn should do. The same facts are kept on every channel. */
export type ConversationOutcome =
  | "NEED_LOCATION"
  | "NEED_FOLLOW_UP"
  | "CREATE_PUBLIC_WORKS"
  | "TRANSFER_HUMAN"
  | "TRANSFER_EMERGENCY";

export type ConversationThread = {
  agencyId: string;
  sessionId: string;
  channel: ConversationChannel;
  outcome: ConversationOutcome;
  alreadyCollected: string[];
  nextQuestion: string | null;
  continuationText: string;
  inJurisdiction: boolean | null;
};

export type PilotCallMeasurement = {
  responseLatencyMs: number | null;
  interruptionHandled: boolean;
  taskCompleted: boolean;
  incorrectRouting: boolean;
  emergencyEscalationReliable: boolean | null;
  satisfactionScore: number | null;
};

const ROADWAY =
  /\b(blocked|blocking|tree down|downed tree|fallen tree)\b.{0,48}\b(road|street|roadway|lane|intersection)\b|\b(road|street|roadway)\b.{0,48}\b(blocked|blocking|closed)\b/i;

const ASKS_FOR_LOCATION = /\b(where|address|location|cross street)\b/i;

export function knownFactLines(intake: CallIntakeData | null | undefined): string[] {
  const row = intake ?? {};
  const lines: string[] = [];
  if (row.locationText?.trim()) lines.push(`Location: ${row.locationText.trim()}`);
  if (row.crossStreets?.trim()) lines.push(`Cross streets: ${row.crossStreets.trim()}`);
  if (row.apartmentSuite?.trim()) lines.push(`Apartment: ${row.apartmentSuite.trim()}`);
  if (row.callerName?.trim()) lines.push(`Name: ${row.callerName.trim()}`);
  if (row.callbackNumber?.trim()) lines.push(`Callback: ${row.callbackNumber.trim()}`);
  if (row.injuries === true) lines.push("Injuries reported");
  if (row.injuries === false) lines.push("No injuries reported");
  return lines;
}

function isRoadway(utterance: string, intake: CallIntakeData): boolean {
  const hint = `${utterance} ${intake.incidentTypeHint ?? ""} ${intake.summary ?? ""}`;
  return ROADWAY.test(hint);
}

/**
 * One conversation across the phone, a text, and a person.
 * A fact already collected is not asked again.
 */
export function continueConversation(opts: {
  agencyId: string;
  sessionId: string;
  channel: ConversationChannel;
  intake?: CallIntakeData | null;
  utterance?: string | null;
  tenantCity?: string | null;
  tenantState?: string | null;
  callerAskedForPerson?: boolean;
  emergency?: boolean;
}): ConversationThread {
  const intake = opts.intake ?? {};
  const utterance = opts.utterance?.trim() ?? "";
  const alreadyCollected = knownFactLines(intake);
  const danger =
    opts.emergency === true ||
    intake.injuries === true ||
    intake.weaponsMentioned === true ||
    Boolean(utterance && checkEmergencyKeywords(utterance));
  const jurisdiction = jurisdictionHint({
    city: intake.locationText,
    state: opts.tenantState,
    tenantCity: opts.tenantCity,
    tenantState: opts.tenantState,
  });
  const inJurisdiction = intake.jurisdictionMatch ?? (intake.locationText?.trim() ? jurisdiction.match : null);
  const continuationText = alreadyCollected.length
    ? `I already have ${alreadyCollected.join("; ")}. I won't ask for that again.`
    : "I don't have any details yet.";

  const base = {
    agencyId: opts.agencyId,
    sessionId: opts.sessionId,
    channel: opts.channel,
    alreadyCollected,
    continuationText,
    inJurisdiction,
  };

  if (danger) {
    return { ...base, outcome: "TRANSFER_EMERGENCY", nextQuestion: null };
  }
  if (opts.callerAskedForPerson) {
    return { ...base, outcome: "TRANSFER_HUMAN", nextQuestion: null };
  }
  if (intake.locationText?.trim() && inJurisdiction === false) {
    const city = opts.tenantCity?.trim() || "this city";
    return {
      ...base,
      outcome: "TRANSFER_HUMAN",
      nextQuestion: `That location looks outside ${city}. I'll connect you with the agency that covers it.`,
    };
  }
  if (!intake.locationText?.trim()) {
    return { ...base, outcome: "NEED_LOCATION", nextQuestion: "Where is this happening?" };
  }
  if (isRoadway(utterance, intake) && intake.injuries === undefined) {
    return {
      ...base,
      outcome: "NEED_FOLLOW_UP",
      nextQuestion: "Is the road completely blocked, and is anyone hurt?",
    };
  }
  if (isRoadway(utterance, intake)) {
    return { ...base, outcome: "CREATE_PUBLIC_WORKS", nextQuestion: null };
  }
  return { ...base, outcome: "NEED_FOLLOW_UP", nextQuestion: null };
}

/** Drop a question that asks for a fact this conversation already has. */
export function replyWithoutRepeating(lexText: string, thread: ConversationThread): string {
  const asksLocation = ASKS_FOR_LOCATION.test(lexText);
  const hasLocation = thread.alreadyCollected.some((line) => line.startsWith("Location:"));
  if (!asksLocation || !hasLocation) return lexText;
  if (thread.nextQuestion) return `${thread.continuationText} ${thread.nextQuestion}`;
  return thread.continuationText;
}

/** First-release measures for a municipal pilot. */
export function measurePilotCall(opts: {
  responseLatencyMs?: number | null;
  bargeInCount?: number | null;
  outcome: ConversationOutcome;
  expectedOutcome?: ConversationOutcome | null;
  emergencyDetected: boolean;
  emergencyTransferred: boolean;
  satisfactionScore?: number | null;
}): PilotCallMeasurement {
  const completed =
    opts.outcome === "CREATE_PUBLIC_WORKS" ||
    opts.outcome === "TRANSFER_HUMAN" ||
    opts.outcome === "TRANSFER_EMERGENCY";
  return {
    responseLatencyMs: opts.responseLatencyMs ?? null,
    interruptionHandled: (opts.bargeInCount ?? 0) > 0,
    taskCompleted: completed,
    incorrectRouting: Boolean(opts.expectedOutcome && opts.expectedOutcome !== opts.outcome),
    emergencyEscalationReliable: opts.emergencyDetected ? opts.emergencyTransferred : null,
    satisfactionScore: opts.satisfactionScore ?? null,
  };
}
