import {
  extractIntakeFields,
  intakeCompleteness,
  mergeIntakeFromLexSlots,
  utteranceHasCorrectionCue,
  type CallIntakeData,
} from "./intake.js";

export type ConversationMemorySnapshot = {
  intake: CallIntakeData;
  collectedFields: string[];
  missingFields: string[];
  correctedFields: string[];
  newlyCollected: string[];
  hadCorrectionCue: boolean;
};

const TRACKED: Array<keyof CallIntakeData> = [
  "locationText",
  "apartmentSuite",
  "crossStreets",
  "directionOfTravel",
  "vehicleYear",
  "vehicleMake",
  "vehicleModel",
  "vehicleColor",
  "vehiclePlate",
  "vehicleUnknown",
  "suspectDescription",
  "callbackNumber",
  "callerName",
  "weaponsMentioned",
  "injuries",
  "isInProgress",
  "preferredLanguage",
];

function fieldValue(intake: CallIntakeData, key: keyof CallIntakeData): unknown {
  return intake[key];
}

function isFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return true;
  return String(value).trim().length > 0;
}

/** Diff which tracked fields changed between prior and next intake. */
export function diffIntakeFields(prior: CallIntakeData, next: CallIntakeData): string[] {
  const changed: string[] = [];
  for (const key of TRACKED) {
    const a = fieldValue(prior, key);
    const b = fieldValue(next, key);
    if (!isFilled(b)) continue;
    if (a === b) continue;
    if (typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase()) {
      continue;
    }
    changed.push(String(key));
  }
  return changed;
}

/**
 * Apply one caller utterance onto prior structured intake (conversation memory).
 * Implicit extraction + correction overwrite + Lex slot merge.
 */
export function applyConversationTurn(opts: {
  prior: CallIntakeData;
  utterance: string;
  slotMap?: Record<string, string | null | undefined>;
}): ConversationMemorySnapshot {
  const prior = opts.prior ?? {};
  const hadCorrectionCue = utteranceHasCorrectionCue(opts.utterance);
  // Slots first, then utterance — correction / implicit extract wins over stale Lex slots.
  const fromSlots = opts.slotMap ? mergeIntakeFromLexSlots(opts.slotMap, prior) : prior;
  const intake = extractIntakeFields(opts.utterance, fromSlots);
  const completeness = intakeCompleteness(intake);
  const changed = diffIntakeFields(prior, intake);
  const priorFilled = new Set(intakeCompleteness(prior).filled);
  const newlyCollected = changed.filter((f) => !priorFilled.has(f));
  const correctedFields = hadCorrectionCue
    ? changed.filter((f) => priorFilled.has(f))
    : [];

  return {
    intake,
    collectedFields: completeness.filled,
    missingFields: completeness.missing,
    correctedFields,
    newlyCollected,
    hadCorrectionCue,
  };
}

/** Compact session-attribute payload (Lex  attrs are size-limited). */
export function conversationMemorySessionPatch(snap: ConversationMemorySnapshot): Record<string, string> {
  return {
    collectedFields: snap.collectedFields.join(","),
    missingFields: snap.missingFields.slice(0, 12).join(","),
    ...(snap.correctedFields.length ? { lastCorrectedFields: snap.correctedFields.join(",") } : {}),
    ...(snap.hadCorrectionCue ? { lastTurnCorrection: "1" } : { lastTurnCorrection: "0" }),
  };
}

/**
 * Short spoken ack for a corrected field — Absolute Speech Rules.
 * Example: "Honda. Got it."
 */
export function spokenCorrectionAck(correctedFields: string[], intake: CallIntakeData): string | null {
  if (!correctedFields.length) return null;
  const preferred = ["vehicleMake", "vehicleModel", "vehicleColor", "vehiclePlate", "locationText", "callerName"];
  const key = preferred.find((k) => correctedFields.includes(k)) ?? correctedFields[0];
  const raw = intake[key as keyof CallIntakeData];
  if (raw === undefined || raw === null || raw === "") return null;
  const spoken = String(raw).trim();
  if (!spoken) return null;
  const short = spoken.length > 40 ? `${spoken.slice(0, 37)}…` : spoken;
  if (key === "vehicleMake" || key === "vehicleModel" || key === "vehicleColor") {
    return `${capitalizeWord(short)}. Got it.`;
  }
  if (key === "locationText") return `${short}. Got it.`;
  return `Got it — ${short}.`;
}

function capitalizeWord(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
