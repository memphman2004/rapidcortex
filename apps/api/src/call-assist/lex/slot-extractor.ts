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
  "ParkingVehicleDescription",
  "BurglaryVehicleDescription",
  "TowVehicleDescription",
  "OtherVehicleDescription",
  "vehicleDesc",
]);

export function isVehicleDescriptionSlot(name: string | undefined | null): boolean {
  return Boolean(name && VEHICLE_DESCRIPTION_SLOT_NAMES.has(name));
}

/**
 * Lex often fails to fill free-form description slots. If we just asked for a
 * slot and the caller spoke, treat the utterance as the value so we do not loop.
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
  slots[name] = asLexSlot(spoken.slice(0, 500));
}
