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
