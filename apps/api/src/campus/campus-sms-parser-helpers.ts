import type { CampusHelpType } from "./campus-types.js";

export const TYPE_KEYWORDS: Record<CampusHelpType, string[]> = {
  medical: [
    "medical",
    "hurt",
    "injured",
    "bleeding",
    "seizure",
    "unconscious",
    "not breathing",
    "chest pain",
    "overdose",
    "ems",
  ],
  security: [
    "security",
    "threat",
    "weapon",
    "fight",
    "assault",
    "gun",
    "knife",
    "threatening",
    "active shooter",
    "suspicious person",
  ],
  mental_health: [
    "mental health",
    "mental",
    "suicidal",
    "suicide",
    "self harm",
    "self-harm",
    "crisis",
    "emotional",
    "breakdown",
    "hurting myself",
  ],
  suspicious_activity: [
    "suspicious",
    "weird",
    "strange",
    "something wrong",
    "doesn't look right",
    "lurking",
  ],
  wellness_check: [
    "wellness",
    "check on",
    "concerned about",
    "not seen",
    "worried about",
    "wellbeing",
    "well-being",
  ],
  property_crime: [
    "stolen",
    "theft",
    "broke",
    "burglary",
    "vandalism",
    "missing laptop",
    "car broken",
    "robbery",
  ],
  maintenance: [
    "broken",
    "leak",
    "spill",
    "hazard",
    "damage",
    "elevator",
    "lights out",
    "smell gas",
    "flood",
  ],
  active_threat: ["active threat", "lockdown", "shooter", "bomb", "explosion", "evacuate", "emergency"],
  other: [],
};

export function detectCampusHelpTypeFromText(text: string): CampusHelpType {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return type as CampusHelpType;
    }
  }
  return "other";
}
