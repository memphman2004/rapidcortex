import { LEX_SPEC_LOCATION_SLOT_NAMES, LEX_SPEC_SLOTS } from "../lex-spec-slots.js";
import type { LexSlotValue } from "../types.js";
import { INTENT_MAP } from "./intents.js";

/** Legacy Lex intents whose NLU still wins over 311 category intents. SMS-only remap. */
export const SMS_LEGACY_TO_311: Record<string, string> = {
  PublicWorksIssue: "ReportRoadsInfrastructure",
  NoiseComplaint: "ReportNoiseComplaint",
  AbandonedVehicle: "ReportVehicleIssue",
  AnimalComplaint: "ReportAnimalsPests",
  VandalismDamage: "ReportGraffitiVandalism",
};

export function slotNamesForIntent(intentName: string): Set<string> {
  const names = new Set<string>();
  const taxonomy = INTENT_MAP[intentName];
  if (taxonomy) {
    for (const slot of taxonomy.slots) names.add(slot.name);
  }
  const spec = LEX_SPEC_SLOTS[intentName];
  if (spec) {
    for (const slot of spec) names.add(slot.name);
  }
  return names;
}

export function addressSlotForIntent(intentName: string): string | null {
  const allowed = slotNamesForIntent(intentName);
  if (allowed.has("ServiceAddress")) return "ServiceAddress";
  for (const name of LEX_SPEC_LOCATION_SLOT_NAMES) {
    if (allowed.has(name)) return name;
  }
  return null;
}

const TAXONOMY_SLOT_EXTRAS = new Set([
  "ServiceAddress",
  "IsOngoing",
  "CallerName",
  "CallbackNumber",
  "IssueDescription",
  "VehicleDescription",
]);

function isTaxonomyOnlySlot(name: string, allowed: Set<string>): boolean {
  if (allowed.has(name)) return false;
  if (TAXONOMY_SLOT_EXTRAS.has(name)) return true;
  if (name.endsWith("SubIssue")) return true;
  return false;
}

export function sanitizeSlotsForIntent(
  intentName: string,
  slots: Record<string, LexSlotValue | null>,
): Record<string, LexSlotValue | null> {
  const allowed = slotNamesForIntent(intentName);
  const is311 = Boolean(INTENT_MAP[intentName]);
  if (allowed.size === 0) {
    const stripped: Record<string, LexSlotValue | null> = {};
    for (const [name, value] of Object.entries(slots)) {
      if (isTaxonomyOnlySlot(name, allowed)) continue;
      stripped[name] = value;
    }
    return stripped;
  }
  const next: Record<string, LexSlotValue | null> = {};
  for (const name of allowed) {
    next[name] = slots[name] ?? null;
  }
  if (is311) return next;
  for (const [name, value] of Object.entries(slots)) {
    if (allowed.has(name)) continue;
    if (isTaxonomyOnlySlot(name, allowed)) continue;
    next[name] = value;
  }
  return next;
}

function interpreted(slot: LexSlotValue | null | undefined): string | null {
  return slot?.value?.interpretedValue?.trim() || slot?.value?.originalValue?.trim() || null;
}

function asSlot(value: string): LexSlotValue {
  return {
    value: { originalValue: value, interpretedValue: value, resolvedValues: [value] },
  };
}

/**
 * Copy filled location/type from a legacy intent onto the 311 destination slots.
 */
export function remapLegacySmsSlots(
  fromIntent: string,
  toIntent: string,
  slots: Record<string, LexSlotValue | null>,
): Record<string, LexSlotValue | null> {
  const next: Record<string, LexSlotValue | null> = { ...slots };
  const loc =
    interpreted(slots.ServiceAddress) ||
    interpreted(slots.PublicWorksLocation) ||
    interpreted(slots.NoiseLocation) ||
    interpreted(slots.VehicleLocation) ||
    interpreted(slots.VandalismLocation) ||
    interpreted(slots.AnimalLocation);
  const destAddr = addressSlotForIntent(toIntent);
  if (loc && destAddr) next[destAddr] = asSlot(loc);

  if (fromIntent === "PublicWorksIssue" && toIntent === "ReportRoadsInfrastructure") {
    const issue = interpreted(slots.PublicWorksIssueType);
    if (issue && /pothole/i.test(issue)) next.RoadsSubIssue = asSlot("POTHOLE");
  }
  return sanitizeSlotsForIntent(toIntent, next);
}
