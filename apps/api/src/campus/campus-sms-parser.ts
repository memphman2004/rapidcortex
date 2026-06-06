import type { CampusHelpType } from "./campus-types.js";

export type { CampusHelpType };

export interface ParsedCampusSms {
  campusCode: string;
  rawMessage: string;
  detectedType: CampusHelpType;
  buildingHint: string;
  roomHint: string;
  cleanDescription: string;
  hasCode: true;
}

export function getKnownCampusCodes(): Set<string> {
  const raw = process.env.CAMPUS_CODES ?? "UGA,GT,GSU,SPELMAN,MOREHOUSE";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

const TYPE_KEYWORDS: Record<CampusHelpType, string[]> = {
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

const BUILDING_NAMES: Record<string, string> = {
  caldwell: "Caldwell Hall",
  tate: "Tate Student Center",
  myers: "Myers Hall",
  bolton: "Bolton Dining Commons",
  ramsey: "Ramsey Student Center",
  mlc: "Miller Learning Center",
  "miller learning": "Miller Learning Center",
  reed: "Reed Hall",
  arch: "The Arch",
  parking: "North Deck Parking",
};

function detectCampusHelpType(text: string): CampusHelpType {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return type as CampusHelpType;
    }
  }
  return "other";
}

function extractBuildingHint(text: string): string {
  const lower = text.toLowerCase();
  for (const [abbr, label] of Object.entries(BUILDING_NAMES)) {
    if (lower.includes(abbr)) return label;
  }
  const match = text.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Hall|Center|Building|Library|Commons)\b/,
  );
  return match?.[0] ?? "";
}

function extractRoomHint(text: string): string {
  const match = text.match(/\b(?:room|rm|suite|apt|apartment)\s*#?\s*(\w+)\b/i);
  return match?.[1] ?? "";
}

export function parseCampusSms(body: string): ParsedCampusSms | null {
  const trimmed = body.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) return null;

  const first = parts[0].toUpperCase();
  if (!getKnownCampusCodes().has(first)) return null;

  const rest = parts.slice(1).join(" ");
  return {
    campusCode: first,
    rawMessage: trimmed,
    detectedType: detectCampusHelpType(rest),
    buildingHint: extractBuildingHint(rest),
    roomHint: extractRoomHint(rest),
    cleanDescription: rest,
    hasCode: true,
  };
}
