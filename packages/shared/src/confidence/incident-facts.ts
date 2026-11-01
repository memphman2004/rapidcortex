/**
 * Facts already stored on the incident (address, nature, title).
 * The picture scorer only trusts a transcript quote, so a call that already
 * has "Shots Fired" and a street address was shown as 0% with those fields missing.
 * These seeds fill that gap without pretending the caller just said them.
 */
import { computeAggregate, toLevel, toTrend } from "./scoring.js";
import { FIELD_REGISTRY, type ConfidenceAnalysis, type FieldConfidence } from "./types.js";

export type IncidentPictureSource = {
  title?: string | null;
  callerAddressLine?: string | null;
  cadLocation?: string | null;
  cadIntersection?: string | null;
  cadNatureCode?: string | null;
  category?: string | null;
};

export type PictureFactSeed = {
  field: "location" | "incidentType" | "weapons";
  value: string;
  score: number;
  reason: string;
  suggestedQuestion: string | null;
};

const STREET =
  /\b(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|way|pkwy|parkway|hwy|highway|trl|trail|pl|place|cir|circle|ter|terrace)\b/i;

const WEAPON =
  /\b(shots?|shooting|gunshot|gun|firearm|handgun|rifle|knife|stab(?:bed|bing)?|weapon)\b/i;

const NATURE_LABEL: Record<string, string> = {
  SHOTS: "Shots fired",
  SHOT: "Shots fired",
  SHOOT: "Shots fired",
  SHOOTING: "Shots fired",
  GUN: "Firearm reported",
  GUNSHOT: "Shots fired",
  STAB: "Stabbing",
  STABBING: "Stabbing",
  KNIFE: "Knife reported",
  ROB: "Robbery",
  ROBBERY: "Robbery",
  FIRE: "Fire",
  MEDICAL: "Medical emergency",
  MED: "Medical emergency",
};

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function incidentTypeLabel(source: IncidentPictureSource): string | null {
  const title = clean(source.title).split(/\s+[—–]\s+|\s+-\s+/)[0]?.trim() ?? "";
  if (title && !/^unknown$/i.test(title) && title.length > 2) return title;
  const nature = clean(source.cadNatureCode).toUpperCase();
  if (NATURE_LABEL[nature]) return NATURE_LABEL[nature];
  const category = clean(source.category);
  if (category && !/^(unknown|other)$/i.test(category)) {
    return category.charAt(0).toUpperCase() + category.slice(1);
  }
  return null;
}

function locationValue(source: IncidentPictureSource): string | null {
  const location = clean(source.cadLocation) || clean(source.callerAddressLine);
  const intersection = clean(source.cadIntersection);
  const value = location || intersection;
  if (!value || value.length < 6) return null;
  const hasStreet = STREET.test(value) || /\b(and|&)\b/i.test(value);
  if (!hasStreet) return null;
  return value;
}

function locationIsSpecific(value: string): boolean {
  return /\d/.test(value) || value.includes(",") || /\b(and|&)\b/i.test(value);
}

export function callHasWeaponSignal(text: string): boolean {
  return WEAPON.test(text);
}

export function seedsFromIncidentFacts(source: IncidentPictureSource): PictureFactSeed[] {
  const seeds: PictureFactSeed[] = [];
  const location = locationValue(source);
  if (location) {
    const specific = locationIsSpecific(location);
    seeds.push({
      field: "location",
      value: location,
      score: specific ? 76 : 58,
      reason: "This address is already on the incident. It was not taken from a new transcript line.",
      suggestedQuestion: specific ? null : FIELD_REGISTRY.location.questionTemplate,
    });
  }

  const incidentType = incidentTypeLabel(source);
  if (incidentType) {
    seeds.push({
      field: "incidentType",
      value: incidentType,
      score: 80,
      reason: "The incident type is already on the call. It was not taken from a new transcript line.",
      suggestedQuestion: null,
    });
  }

  const weaponText = [source.title, source.cadNatureCode, incidentType].map(clean).join(" ");
  if (callHasWeaponSignal(weaponText)) {
    seeds.push({
      field: "weapons",
      value: incidentType && callHasWeaponSignal(incidentType) ? incidentType : "Weapon reported on the incident",
      score: 64,
      reason: "A weapon is indicated by the incident type. A description of the weapon is not confirmed yet.",
      suggestedQuestion: FIELD_REGISTRY.weapons.questionTemplate,
    });
  }

  return seeds;
}

const STALE_TRIAGE_RATIONALE = "Insufficient signal for high-confidence classification.";

/**
 * Replace the generic triage fallback when the incident record already has a type or address.
 * A stored rationale that is not that fallback is left unchanged.
 */
export function incidentPictureRationale(
  stored: string | null | undefined,
  source: IncidentPictureSource,
): string {
  const text = (stored ?? "").trim();
  const seeds = seedsFromIncidentFacts(source);
  const stale = text.length === 0 || text === STALE_TRIAGE_RATIONALE;
  if (!stale || seeds.length === 0) return text || "No rationale yet.";
  const incidentType = seeds.find((seed) => seed.field === "incidentType")?.value;
  const location = seeds.find((seed) => seed.field === "location")?.value;
  const weaponOpen = seeds.some((seed) => seed.field === "weapons");
  const parts = [
    incidentType ? `The incident is already recorded as ${incidentType}.` : null,
    location ? `Location on the incident: ${location}.` : null,
    weaponOpen
      ? "Those facts are already on the call. Injuries and a weapon description are still open, so the picture stays incomplete."
      : "Those facts are already on the call. Other critical details are still open, so the picture stays incomplete.",
  ].filter((part): part is string => Boolean(part));
  return parts.join(" ");
}

export function incidentPictureFactsBrief(source: IncidentPictureSource): string {
  const seeds = seedsFromIncidentFacts(source);
  if (seeds.length === 0) return "";
  const lines = seeds.map((seed) => `- ${seed.field}: ${seed.value}`);
  return [
    "Already stored on the incident record. These are not new caller statements and must not be marked missing:",
    ...lines,
  ].join("\n");
}

function blankField(fieldKey: string, segmentCount: number): FieldConfidence {
  const meta = FIELD_REGISTRY[fieldKey];
  return {
    field: fieldKey,
    label: meta.label,
    value: null,
    score: 0,
    level: "MISSING",
    trend: "STABLE",
    trendDelta: 0,
    reason: "Not mentioned in the transcript.",
    suggestedQuestion: meta.weight === "CRITICAL" || meta.weight === "HIGH" ? meta.questionTemplate : null,
    weight: meta.weight,
    lastUpdatedAtSegment: segmentCount,
    conflictingValues: [],
  };
}

export function blankPictureAnalysis(input: {
  incidentId: string;
  agencyId: string;
  version: number;
  segmentCount?: number;
  previousVersion?: number;
}): ConfidenceAnalysis {
  const segmentCount = input.segmentCount ?? 0;
  const fields = Object.keys(FIELD_REGISTRY).map((fieldKey) => blankField(fieldKey, segmentCount));
  return {
    incidentId: input.incidentId,
    agencyId: input.agencyId,
    fields,
    aggregate: computeAggregate(fields, 1, segmentCount),
    version: input.version,
    ...(input.previousVersion ? { previousVersion: input.previousVersion } : {}),
  };
}

/**
 * Fill empty picture fields from the incident record, then recompute the aggregate.
 * A value already captured from the transcript is left as-is. A conflict is left as-is.
 */
export function applyIncidentPictureFacts(
  analysis: ConfidenceAnalysis,
  source: IncidentPictureSource,
): ConfidenceAnalysis {
  const seeds = seedsFromIncidentFacts(source);
  if (seeds.length === 0) return analysis;

  const present = new Set(analysis.fields.map((field) => field.field));
  const missing = Object.keys(FIELD_REGISTRY)
    .filter((fieldKey) => !present.has(fieldKey))
    .map((fieldKey) => blankField(fieldKey, analysis.aggregate.segmentCount));
  const fields = [...analysis.fields, ...missing].map((field) => {
    const seed = seeds.find((item) => item.field === field.field);
    if (!seed) return field;
    if (field.level === "CONFLICT") return field;
    if (field.value?.trim()) return field;

    const { trend, delta } = toTrend(seed.score, field.score);
    return {
      ...field,
      value: seed.value,
      score: seed.score,
      level: toLevel(seed.score, false),
      trend,
      trendDelta: delta,
      reason: seed.reason,
      suggestedQuestion: seed.suggestedQuestion,
      sourceQuote: null,
      lastUpdatedAtSegment: analysis.aggregate.segmentCount,
    };
  });

  return {
    ...analysis,
    fields,
    aggregate: computeAggregate(fields, analysis.aggregate.audioQualityFactor, analysis.aggregate.segmentCount),
  };
}

/** Picture built only from the incident record, when no scored analysis exists yet. */
export function pictureFromIncidentFacts(input: {
  incidentId: string;
  agencyId: string;
  source: IncidentPictureSource;
}): ConfidenceAnalysis | null {
  if (seedsFromIncidentFacts(input.source).length === 0) return null;
  return applyIncidentPictureFacts(
    blankPictureAnalysis({ incidentId: input.incidentId, agencyId: input.agencyId, version: 1 }),
    input.source,
  );
}
