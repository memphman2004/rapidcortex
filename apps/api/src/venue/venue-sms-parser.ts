/**
 * Venue SMS parser — extracts venue code and zone from inbound SMS.
 * Campus codes are checked BEFORE venue codes in the inbound handler.
 */

export type VenueHelpType =
  | "medical"
  | "security"
  | "lost_person"
  | "maintenance"
  | "guest_services"
  | "other";

export interface ParsedVenueSms {
  venueCode: string;
  rawMessage: string;
  detectedType: VenueHelpType;
  zoneHint: string; // e.g. "Section 124" or ""
  cleanDescription: string;
  hasCode: true;
}

const TYPE_KEYWORDS: Record<VenueHelpType, string[]> = {
  medical: [
    "medical",
    "hurt",
    "injured",
    "bleeding",
    "unconscious",
    "heart",
    "breathing",
    "seizure",
    "fell",
    "down",
    "ems",
    "ambulance",
  ],
  security: [
    "security",
    "fight",
    "weapon",
    "threat",
    "suspicious",
    "gun",
    "knife",
    "assault",
    "pushing",
    "aggressive",
    "harassment",
  ],
  lost_person: [
    "lost",
    "missing",
    "child",
    "separated",
    "can't find",
    "looking for",
    "find my",
  ],
  maintenance: [
    "spill",
    "broken",
    "leak",
    "damage",
    "hazard",
    "maintenance",
    "door",
    "elevator",
    "stuck",
    "bathroom",
    "restroom",
  ],
  guest_services: [
    "help",
    "question",
    "directions",
    "where",
    "information",
    "ticket",
    "access",
    "wheelchair",
    "assistance",
  ],
  other: [],
};

const ZONE_PATTERNS = [
  /\b(?:section|sec|sect)\s*(\d{1,4}[a-z]?)\b/i,
  /\b(?:gate|entrance)\s*([a-z])\b/i,
  /\b(?:concourse|level)\s*(\d+)\b/i,
  /\b(?:row|seat)\s*(\w+)\b/i,
  /\b(field|club|suite|press\s*box|standing\s*room)\b/i,
];

export function getKnownVenueCodes(): Set<string> {
  const raw = process.env.VENUE_CODES ?? "MBS,TRUIST,STATE_FARM,BofA";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function detectVenueHelpType(text: string): VenueHelpType {
  const lower = text.toLowerCase();
  for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      return type as VenueHelpType;
    }
  }
  return "other";
}

function extractZoneHint(text: string): string {
  for (const pattern of ZONE_PATTERNS) {
    const m = text.match(pattern);
    if (m) return m[0].trim();
  }
  return "";
}

export function parseVenueSms(body: string): ParsedVenueSms | null {
  const trimmed = body.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length === 0) return null;

  const first = parts[0].toUpperCase();
  const codes = getKnownVenueCodes();
  if (!codes.has(first)) return null;

  const rest = parts.slice(1).join(" ");
  return parseVenueSmsForCode(first, rest, trimmed);
}

export function parseVenueSmsForCode(
  venueCode: string,
  description: string,
  rawMessage?: string,
): ParsedVenueSms {
  const detectedType = detectVenueHelpType(description);
  const zoneHint = extractZoneHint(description);
  return {
    venueCode,
    rawMessage: rawMessage ?? description,
    detectedType,
    zoneHint,
    cleanDescription: description,
    hasCode: true,
  };
}
