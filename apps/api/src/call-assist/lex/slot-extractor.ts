import type { LexV2Event, LexSlotValue } from "./types.js";

export function extractCurrentSlots(event: LexV2Event): Record<string, string | null> {
  const slots = event.sessionState.intent.slots ?? {};
  return Object.fromEntries(Object.entries(slots).map(([k, v]) => [k, slotInterpreted(v)]));
}

export function slotInterpreted(slot: LexSlotValue | null | undefined): string | null {
  const v = slot?.value?.interpretedValue?.trim() || slot?.value?.originalValue?.trim();
  return v || null;
}

export function slotFilled(slot: LexSlotValue | null | undefined): boolean {
  return Boolean(slotInterpreted(slot));
}

export function asLexSlot(value: string): LexSlotValue {
  return {
    value: { originalValue: value, interpretedValue: value, resolvedValues: [value] },
    shape: "Scalar",
  };
}

const VEHICLE_DESCRIPTION_SLOT_NAMES = new Set([
  "VehicleDescription",
  "VehicleDetails",
  "ParkingVehicleDescription",
  "BurglaryVehicleDescription",
  "TowVehicleDescription",
  "OtherVehicleDescription",
  "vehicleDesc",
]);

export function isVehicleDescriptionSlot(name: string | undefined | null): boolean {
  return Boolean(name && VEHICLE_DESCRIPTION_SLOT_NAMES.has(name));
}

const YES_NO_SLOT_NAMES = new Set([
  "AbandonedVehicleHazard",
  "IsOngoing",
  "WeaponVisible",
  "InjuriesReported",
  "CallerSafe",
  "LocationConfirmed",
]);

/** Map "no it is not blocking" / "yes that's right" onto Lex YesNoConfirmation values. */
export function normalizeYesNoUtterance(utterance: string): "Yes" | "No" | null {
  const trimmed = utterance
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/g, "")
    .replace(/\s+/g, " ");
  if (!trimmed) return null;
  if (
    /^(yes|yeah|yep|yup|ya|yea|y|true|sure|ok|okay|correct|right|exact|exactly|affirmative|si|sí)\b/.test(
      trimmed,
    ) ||
    /^(that'?s|that is)\s+(correct|right)$/.test(trimmed)
  ) {
    return "Yes";
  }
  if (
    /^(no|nope|nah|naw|n|false|negative|incorrect|wrong)\b/.test(trimmed) ||
    /^(that'?s|that is)\s+(wrong|incorrect|not right)$/.test(trimmed)
  ) {
    return "No";
  }
  if (/\b(not blocking|isn'?t blocking|no hazard|nothing blocking)\b/.test(trimmed)) return "No";
  return null;
}

/**
 * Lex often fails to fill free-form description slots. If we just asked for a
 * slot and the caller spoke, treat the utterance as the value so we do not loop.
 * Yes/No Lex slot types reject free-form phrases — normalize those to Yes/No.
 */
export function capturePromptedSlot(
  slots: Record<string, LexSlotValue | null>,
  promptSlot: string | undefined,
  utterance: string,
): void {
  const name = promptSlot?.trim();
  const spoken = utterance.trim();
  if (!name || !spoken) return;
  if (slotFilled(slots[name])) return;
  if (YES_NO_SLOT_NAMES.has(name) || /Hazard|Confirm|Visible|Injuries|Safe|Ongoing/i.test(name)) {
    const yn = normalizeYesNoUtterance(spoken);
    if (yn) {
      slots[name] = asLexSlot(yn);
      return;
    }
  }
  slots[name] = asLexSlot(spoken.slice(0, 500));
}
