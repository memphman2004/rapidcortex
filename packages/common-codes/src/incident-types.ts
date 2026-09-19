/**
 * APCO ANS 2.103-style common incident types + NENA-friendly aliases.
 * Catalog is a curated operational subset for C2C routing (not the full ANS table).
 * No runtime dependencies.
 */

export type IncidentDiscipline = "law" | "fire" | "ems" | "multi";

export interface CommonIncidentType {
  /** Stable hub code (uppercase, no spaces). */
  code: string;
  /** Dispatcher-facing label. */
  label: string;
  discipline: IncidentDiscipline;
  /** Default C2C priority 1 (highest) – 5 (lowest). */
  defaultPriority: 1 | 2 | 3 | 4 | 5;
  /** Alternate labels / CAD call types that map to this code. */
  aliases: readonly string[];
  /** Whether this type is typically auto-aided across a county line. */
  typicalMutualAid: boolean;
}

export const COMMON_INCIDENT_TYPES: readonly CommonIncidentType[] = [
  { code: "STRFIRE", label: "Structure Fire", discipline: "fire", defaultPriority: 1, aliases: ["STRUCTURE FIRE", "BUILDING FIRE", "FIRE STRUCTURE"], typicalMutualAid: true },
  { code: "VEHFIRE", label: "Vehicle Fire", discipline: "fire", defaultPriority: 2, aliases: ["VEHICLE FIRE", "CAR FIRE"], typicalMutualAid: true },
  { code: "BRUSH", label: "Brush / Wildland Fire", discipline: "fire", defaultPriority: 2, aliases: ["BRUSH FIRE", "WILDLAND", "GRASS FIRE"], typicalMutualAid: true },
  { code: "ALARMF", label: "Fire Alarm", discipline: "fire", defaultPriority: 3, aliases: ["FIRE ALARM", "ALARM FIRE"], typicalMutualAid: false },
  { code: "HAZMAT", label: "Hazardous Materials", discipline: "fire", defaultPriority: 1, aliases: ["HAZMAT", "HAZARDOUS MATERIALS"], typicalMutualAid: true },
  { code: "RESCUE", label: "Technical Rescue", discipline: "fire", defaultPriority: 1, aliases: ["TECH RESCUE", "RESCUE"], typicalMutualAid: true },
  { code: "CARDIAC", label: "Cardiac Arrest", discipline: "ems", defaultPriority: 1, aliases: ["CARDIAC ARREST", "CPR", "CODE BLUE"], typicalMutualAid: true },
  { code: "STROKE", label: "Stroke", discipline: "ems", defaultPriority: 1, aliases: ["CVA", "STROKE"], typicalMutualAid: true },
  { code: "TRAUMA", label: "Trauma", discipline: "ems", defaultPriority: 1, aliases: ["TRAUMA", "MAJOR TRAUMA"], typicalMutualAid: true },
  { code: "OVERDOSE", label: "Overdose", discipline: "ems", defaultPriority: 2, aliases: ["OD", "OVERDOSE", "NARCAN"], typicalMutualAid: false },
  { code: "MEDIC", label: "Medical Emergency", discipline: "ems", defaultPriority: 2, aliases: ["MEDICAL", "MEDICAL EMERGENCY", "SICK PERSON"], typicalMutualAid: false },
  { code: "MVAINJ", label: "MVC with Injuries", discipline: "multi", defaultPriority: 1, aliases: ["MVA INJURY", "MVC INJURY", "PI ACCIDENT", "ACCIDENT INJURY"], typicalMutualAid: true },
  { code: "MVA", label: "Motor Vehicle Accident", discipline: "multi", defaultPriority: 3, aliases: ["MVA", "MVC", "ACCIDENT", "TRAFFIC ACCIDENT"], typicalMutualAid: false },
  { code: "PURSUIT", label: "Vehicle Pursuit", discipline: "law", defaultPriority: 1, aliases: ["PURSUIT", "VEHICLE PURSUIT", "CHASE"], typicalMutualAid: true },
  { code: "SHOTS", label: "Shots Fired", discipline: "law", defaultPriority: 1, aliases: ["SHOTS FIRED", "GUNSHOTS"], typicalMutualAid: true },
  { code: "ROBB", label: "Robbery", discipline: "law", defaultPriority: 1, aliases: ["ROBBERY", "ARMED ROBBERY"], typicalMutualAid: false },
  { code: "ASSLT", label: "Assault", discipline: "law", defaultPriority: 2, aliases: ["ASSAULT", "FIGHT"], typicalMutualAid: false },
  { code: "DOMVIO", label: "Domestic Violence", discipline: "law", defaultPriority: 2, aliases: ["DOMESTIC", "DOMESTIC VIOLENCE"], typicalMutualAid: false },
  { code: "BURG", label: "Burglary", discipline: "law", defaultPriority: 3, aliases: ["BURGLARY", "B&E"], typicalMutualAid: false },
  { code: "DIST", label: "Disturbance", discipline: "law", defaultPriority: 3, aliases: ["DISTURBANCE", "NOISE"], typicalMutualAid: false },
  { code: "SUSP", label: "Suspicious Person / Vehicle", discipline: "law", defaultPriority: 4, aliases: ["SUSPICIOUS", "SUSPICIOUS PERSON", "SUSPICIOUS VEHICLE"], typicalMutualAid: false },
  { code: "TRAFSTP", label: "Traffic Stop", discipline: "law", defaultPriority: 4, aliases: ["TRAFFIC STOP", "T-STOP"], typicalMutualAid: false },
  { code: "WELF", label: "Welfare Check", discipline: "law", defaultPriority: 3, aliases: ["WELFARE CHECK", "WELLBEING"], typicalMutualAid: false },
  { code: "ALARM", label: "Alarm (Law)", discipline: "law", defaultPriority: 3, aliases: ["ALARM", "BURGLAR ALARM"], typicalMutualAid: false },
  { code: "HANGUP", label: "9-1-1 Hang-up", discipline: "law", defaultPriority: 3, aliases: ["911 HANGUP", "9-1-1 HANG-UP", "HANG UP"], typicalMutualAid: false },
] as const;

const BY_CODE = new Map<string, CommonIncidentType>(
  COMMON_INCIDENT_TYPES.map((row) => [row.code, row]),
);

function normalize(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

/**
 * Resolve a CAD call type or hub code to a common incident type.
 */
export function lookupIncidentType(raw: string): CommonIncidentType | undefined {
  const key = normalize(raw);
  if (!key) return undefined;
  const compact = key.replace(/\s+/g, "");
  const direct = BY_CODE.get(compact) ?? BY_CODE.get(key.replace(/\s+/g, ""));
  if (direct) return direct;
  for (const row of COMMON_INCIDENT_TYPES) {
    if (normalize(row.label) === key) return row;
    if (row.aliases.some((alias) => normalize(alias) === key)) return row;
  }
  return undefined;
}

export function listIncidentTypes(discipline?: IncidentDiscipline): CommonIncidentType[] {
  if (!discipline) return [...COMMON_INCIDENT_TYPES];
  return COMMON_INCIDENT_TYPES.filter((row) => row.discipline === discipline);
}

export function isTypicalMutualAid(raw: string): boolean {
  return lookupIncidentType(raw)?.typicalMutualAid === true;
}
