import type { CampusHelpType } from "./campus-types.js";
import { detectCampusHelpTypeFromText } from "./campus-sms-parser-helpers.js";

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
  return detectCampusHelpTypeFromText(text);
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
  return parseCampusSmsForCode(first, rest, trimmed);
}

export function parseCampusSmsForCode(
  campusCode: string,
  description: string,
  rawMessage?: string,
): ParsedCampusSms {
  return {
    campusCode,
    rawMessage: rawMessage ?? description,
    detectedType: detectCampusHelpType(description),
    buildingHint: extractBuildingHint(description),
    roomHint: extractRoomHint(description),
    cleanDescription: description,
    hasCode: true,
  };
}
