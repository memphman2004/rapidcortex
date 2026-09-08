import type { LexSlotValue } from "./types.js";
import { slotInterpreted } from "./slot-extractor.js";
import { LEX_SPEC_LOCATION_SLOT_NAMES } from "./lex-spec-slots.js";

export const EMERGENCY_INTENT = "EmergencyEscalation";
export const REQUEST_HUMAN_INTENT = "RequestHuman";
export const FALLBACK_INTENT = "FallbackIntent";
export const REPEAT_CALL_INTENT = "RepeatCallCheck";
export const PUBLIC_WORKS_INTENT = "PublicWorksIssue";
export const SUSPICIOUS_PERSON_INTENT = "SuspiciousPerson";

const YES_VALUES = new Set([
  "yes",
  "y",
  "yeah",
  "yep",
  "true",
  "sí",
  "si",
  "sip",
  "affirmative",
  "correct",
]);

export function slotIsYes(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (YES_VALUES.has(normalized)) return true;
  return normalized.startsWith("yes");
}

export function slotValueIsYes(slot: LexSlotValue | null | undefined): boolean {
  if (slotIsYes(slotInterpreted(slot))) return true;
  const resolved = slot?.value?.resolvedValues?.[0];
  return slotIsYes(resolved ?? null);
}

function namedSlotIsYes(slots: Record<string, LexSlotValue | null>, names: string[]): boolean {
  return names.some((name) => slotValueIsYes(slots[name]));
}

/** SuspiciousPerson: caller confirmed a weapon. Do not elicit CallbackNumber / CallerSafeLocation. */
export function weaponVisibleYes(slots: Record<string, LexSlotValue | null>): boolean {
  return namedSlotIsYes(slots, ["WeaponVisible", "weapons"]);
}

/** Traffic accident with injuries — immediate officer response. */
export function accidentInjuriesYes(slots: Record<string, LexSlotValue | null>): boolean {
  return namedSlotIsYes(slots, ["AccidentInjuries", "injuries"]);
}

export function animalThreatIsAggressive(slots: Record<string, LexSlotValue | null>): boolean {
  const value = (slotInterpreted(slots.AnimalThreatLevel) ?? "").toLowerCase();
  return /\b(aggressive|attacking|vicious|biting)\b/.test(value);
}

export function locationFromSlotMap(slots: Record<string, string | null>): string {
  for (const name of LEX_SPEC_LOCATION_SLOT_NAMES) {
    const value = slots[name];
    if (value) return value;
  }
  return "unknown location";
}

export type TransferReason =
  | "EMERGENCY"
  | "HUMAN_REQUEST"
  | "LOW_CONFIDENCE"
  | "REPEAT_CALL"
  | "EXTERNAL_311"
  | "INJURY_PRIORITY"
  | "COMPLETE";
