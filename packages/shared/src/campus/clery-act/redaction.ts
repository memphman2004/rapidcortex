import type { CleryOffenseCategory } from "./schemas.js";
import { SEX_OFFENSE_CATEGORIES } from "./schemas.js";

export type VictimSafetyRedactionResult = {
  ok: boolean;
  blockedTerms: string[];
  message?: string;
};

/**
 * Blocks public Daily Crime Log location text that is specific enough to identify
 * or endanger a victim — especially in sex-offense cases (ED program-review finding).
 *
 * This is a gate, not a sanitizer: callers must revise the description.
 */
const LOCATION_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "room_number", re: /\broom(?:\s*(?:no\.?|number|#))?\s*[:#-]?\s*\d{1,6}\b/i },
  { id: "apt_number", re: /\b(?:apt\.?|apartment|unit|suite|ste\.?)\s*[:#-]?\s*[a-z]?\d{1,6}[a-z]?\b/i },
  { id: "hash_unit", re: /(?:^|\s)#\s*\d{2,6}\b/ },
  { id: "bedroom", re: /\b(?:bed(?:room)?|dorm(?:itory)?\s*room)\s*[:#-]?\s*\d{1,4}\b/i },
  { id: "floor_room", re: /\b(?:\d{1,2}(?:st|nd|rd|th)\s+floor.{0,24}room|\broom.{0,24}\d{1,2}(?:st|nd|rd|th)\s+floor)\b/i },
  { id: "victim_word", re: /\bvictims?\b/i },
  { id: "email", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { id: "phone", re: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}\b/ },
  { id: "ssn", re: /\b\d{3}-\d{2}-\d{4}\b/ },
];

const SEX_OFFENSE_EXTRA: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "wing_room", re: /\b(?:wing|hall|tower)\s+[a-z]\b.{0,20}\d{2,4}\b/i },
  { id: "specific_bed", re: /\bbunk\s*[a-d1-4]\b/i },
];

export function isSexOffenseCategory(category: CleryOffenseCategory | undefined): boolean {
  return Boolean(category && (SEX_OFFENSE_CATEGORIES as readonly string[]).includes(category));
}

export function runVictimSafetyRedactionCheck(
  generalLocation: string,
  offense?: CleryOffenseCategory,
): VictimSafetyRedactionResult {
  const text = generalLocation.trim();
  if (!text) {
    return {
      ok: false,
      blockedTerms: ["empty_location"],
      message: "General location is required for the Daily Crime Log.",
    };
  }

  const blockedTerms: string[] = [];
  for (const p of LOCATION_PATTERNS) {
    if (p.re.test(text)) blockedTerms.push(p.id);
  }
  if (isSexOffenseCategory(offense)) {
    for (const p of SEX_OFFENSE_EXTRA) {
      if (p.re.test(text)) blockedTerms.push(p.id);
    }
  }

  if (blockedTerms.length > 0) {
    return {
      ok: false,
      blockedTerms,
      message:
        "Location description is too specific for the public Daily Crime Log. Use a general building or area (for example “Myers Hall Residential”), never a room, apartment, or other identifier that could endanger a victim.",
    };
  }

  return { ok: true, blockedTerms: [] };
}

/**
 * Defense in depth for the unauthenticated Daily Crime Log: never emit a location
 * that would fail the victim-safety gate, even if a stored entry is malformed.
 */
export function isSafeForPublicCrimeLog(
  generalLocation: string,
  offense?: CleryOffenseCategory,
): boolean {
  return runVictimSafetyRedactionCheck(generalLocation, offense).ok;
}

export function filterPublicCrimeLogEntries<
  T extends { generalLocation: string; cleryOffenseCategory?: CleryOffenseCategory },
>(entries: readonly T[]): T[] {
  return entries.filter((e) => isSafeForPublicCrimeLog(e.generalLocation, e.cleryOffenseCategory));
}
