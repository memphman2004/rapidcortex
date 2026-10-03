import { normalizePreferredLanguage } from "./language.js";

export type CallIntakeData = {
  locationText?: string;
  locationLat?: number;
  locationLng?: number;
  locationSource?: "CALLER" | "ANI_ALI" | "RAPIDSOS" | "GIS" | "UNKNOWN";
  incidentTypeHint?: string;
  isInProgress?: boolean;
  injuries?: boolean;
  injuriesDetail?: string;
  weaponsMentioned?: boolean;
  weaponsDetail?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  /** Caller could not or would not give remaining vehicle details (plate, make, etc.). */
  vehicleUnknown?: boolean;
  suspectDescription?: string;
  apartmentSuite?: string;
  crossStreets?: string;
  directionOfTravel?: string;
  callbackNumber?: string;
  callerName?: string;
  language?: string;
  /** Durable preferred language for the call record (en | es | und). */
  preferredLanguage?: string;
  addressConfidence?: number;
  zoneId?: string;
  zoneName?: string;
  jurisdictionMatch?: boolean;
  jurisdictionLabel?: string;
  summary?: string;
};

const LOCATION_RE =
  /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pkwy|parkway|trl|trail)\b)?[^.!?]{0,40})/i;
const PLATE_RE = /\b(?:plate|tag|license)\s*(?:number|no\.?)?\s*[:#]?\s*([A-Z0-9]{2,8})\b/i;
const CALLBACK_RE = /\b(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/;
const NAME_RE = /\b(?:my name is|this is)\s+([A-Za-z][A-Za-z'-]{1,30}(?:\s+[A-Za-z][A-Za-z'-]{1,30})?)/i;
const APT_RE = /\b(?:apt\.?|apartment|unit|suite|ste\.?|#)\s*[:#-]?\s*([A-Za-z]?\d{1,6}[A-Za-z]?)\b/i;
const CROSS_RE =
  /\b(?:cross streets?|nearest (?:intersection|cross)|at the corner of|intersection of)\s+([^,.!?]{3,80})/i;
const AND_STREETS_RE =
  /\b([A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+)?)\s+(?:and|&)\s+([A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+)?)\s+(?:st|street|ave|avenue|rd|road|blvd|dr|drive)\b/i;
const DIRECTION_RE =
  /\b(?:heading|going|traveling|last seen going|direction of travel)\s+(north(?:east|west)?|south(?:east|west)?|east|west)(?:bound)?\b/i;
const YEAR_RE = /\b((?:19|20)\d{2})\b/;
const MAKE_RE =
  /\b(ford|chevy|chevrolet|toyota|honda|nissan|dodge|jeep|bmw|mercedes|hyundai|kia|tesla|gmc|ram|volkswagen|vw|subaru|mazda|lexus|audi|chrysler|buick|cadillac|volvo|acura|infiniti)\b/i;
const MODEL_RE =
  /\b(f-?150|silverado|civic|accord|camry|corolla|altima|sentra|ram(?:\s*1500)?|wrangler|cherokee|explorer|escape|tahoe|suburban|mustang|focus|prius|rav4|cr-?v|pilot|odyssey|highlander|tundra|tacoma|sierra|equinox|malibu|impala|charger|challenger|durango|grand cherokee)\b/i;
const BODY_STYLE_RE =
  /\b(sedan|coupe|hatchback|suv|crossover|van|minivan|pickup(?:\s+truck)?|truck|motorcycle|convertible|wagon)\b/i;
const COLOR_RE = /\b(red|blue|black|white|silver|gray|grey|green|yellow|maroon|gold|brown|tan|orange|purple)\b/i;
const VEHICLE_DECLINE_RE =
  /\b((i\s+)?don'?t\s+(know|have|see).{0,24}(make|model|color|plate|tag|vehicle|car)|no\s+(i\s+)?(can'?t\s+see|don'?t\s+have)\s+(the\s+)?(plate|tag)|no\s+plate|can'?t\s+see\s+the\s+plate)\b/i;
const WEAPON_DETAIL_RE = /\b((?:hand)?gun|pistol|rifle|shotgun|knife|machete|bat|taser|weapon)s?\b/i;
const INJURY_DETAIL_RE = /\b(bleeding|broken (?:arm|leg|bone)|unconscious|shot|stabbed|hurt|injured)\b/i;
const SUSPECT_RE =
  /\b((?:young |older )?(?:black |white |hispanic |latino |asian )?(?:male|female|man|woman)(?:[^,.]{0,80})?)/i;

function merge(base: CallIntakeData, patch: CallIntakeData): CallIntakeData {
  const next = { ...base };
  for (const [k, v] of Object.entries(patch) as Array<[keyof CallIntakeData, CallIntakeData[keyof CallIntakeData]]>) {
    if (v !== undefined && v !== "") next[k] = v as never;
  }
  return next;
}

/** Caller is revising a prior answer ("wait, Honda" / "actually 1520"). */
const CORRECTION_CUE_RE =
  /\b(wait|actually|i mean|sorry[, ]|no[, ]+(?:it'?s|wait)|not (?:a |the )?|correction|hold on)\b/i;

export function utteranceHasCorrectionCue(text: string): boolean {
  return CORRECTION_CUE_RE.test(text);
}

/**
 * Prefer the clause after the last correction cue so "Toyota — wait, Honda"
 * yields Honda, not Toyota.
 */
export function textAfterLastCorrectionCue(text: string): string {
  if (!utteranceHasCorrectionCue(text)) return text;
  const parts = text.split(CORRECTION_CUE_RE);
  const tail = parts[parts.length - 1]?.trim();
  return tail && tail.length >= 2 ? tail : text;
}

function lastMatch(re: RegExp, text: string): RegExpExecArray | null {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const global = new RegExp(re.source, flags);
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = global.exec(text)) !== null) {
    last = m;
    if (m.index === global.lastIndex) global.lastIndex += 1;
  }
  return last;
}

export function parseVehicleDescription(
  text: string,
  prior: CallIntakeData = {},
  opts?: { force?: boolean },
): CallIntakeData {
  const force = Boolean(opts?.force);
  const patch: CallIntakeData = {};
  const year = lastMatch(YEAR_RE, text);
  if (year?.[1] && (force || !prior.vehicleYear)) patch.vehicleYear = year[1];
  const make = lastMatch(MAKE_RE, text);
  if (make?.[1] && (force || !prior.vehicleMake)) patch.vehicleMake = make[1];
  const model = lastMatch(MODEL_RE, text);
  if (model?.[1] && (force || !prior.vehicleModel)) patch.vehicleModel = model[1].replace(/\s+/g, " ");
  const body = lastMatch(BODY_STYLE_RE, text);
  if (body?.[1] && (force || (!prior.vehicleModel && !patch.vehicleModel))) {
    patch.vehicleModel = body[1].replace(/\s+/g, " ");
  }
  const color = lastMatch(COLOR_RE, text);
  if (color?.[1] && (force || !prior.vehicleColor)) patch.vehicleColor = color[1];
  const plate = lastMatch(PLATE_RE, text);
  if (plate?.[1] && (force || !prior.vehiclePlate)) patch.vehiclePlate = plate[1].toUpperCase();
  if (VEHICLE_DECLINE_RE.test(text)) patch.vehicleUnknown = true;
  return patch;
}

/** True when we have enough vehicle identity to stop asking color / make / model. */
export function vehicleDescriptionSatisfied(intake: CallIntakeData): boolean {
  if (intake.vehicleUnknown) return true;
  return Boolean(
    intake.vehicleMake?.trim() ||
      intake.vehicleModel?.trim() ||
      intake.vehicleColor?.trim() ||
      intake.vehiclePlate?.trim() ||
      intake.vehicleYear?.trim(),
  );
}

/**
 * Deterministic field extraction.
 * Correction cues allow overwrite of already-collected fields (Phase 2).
 * Without a cue, confirmed fields are not replaced by weaker re-mentions.
 */
export function extractIntakeFields(utterance: string, prior: CallIntakeData = {}): CallIntakeData {
  const correcting = utteranceHasCorrectionCue(utterance);
  const text = correcting ? textAfterLastCorrectionCue(utterance) : utterance;
  const patch: CallIntakeData = { ...parseVehicleDescription(text, correcting ? {} : prior, { force: correcting }) };
  const loc = LOCATION_RE.exec(text);
  if (loc?.[1] && (correcting || !prior.locationText?.trim())) {
    patch.locationText = loc[1].trim();
    patch.locationSource = prior.locationSource === "ANI_ALI" && !correcting ? "ANI_ALI" : "CALLER";
  }
  const apt = APT_RE.exec(text);
  if (apt?.[1] && (correcting || !prior.apartmentSuite?.trim())) patch.apartmentSuite = apt[1].toUpperCase();
  const cross = CROSS_RE.exec(text) ?? AND_STREETS_RE.exec(text);
  if (cross && (correcting || !prior.crossStreets?.trim())) {
    patch.crossStreets = (cross[1] && cross[2] ? `${cross[1]} and ${cross[2]}` : cross[1]).trim();
  }
  const dir = DIRECTION_RE.exec(text);
  if (dir?.[1] && (correcting || !prior.directionOfTravel?.trim())) {
    patch.directionOfTravel = dir[1].toLowerCase();
  }
  if (/\b(happening (right )?now|still going on|in progress)\b/i.test(text)) patch.isInProgress = true;
  if (/\b(yesterday|last night|earlier today|already happened|not happening now)\b/i.test(text)) {
    patch.isInProgress = false;
  }
  const injuryDetail = INJURY_DETAIL_RE.exec(text);
  if (injuryDetail?.[1]) {
    patch.injuries = true;
    patch.injuriesDetail = injuryDetail[1];
  }
  if (/\bno one (is |was )?hurt\b|\bno injur/i.test(text)) patch.injuries = false;
  const weaponDetail = WEAPON_DETAIL_RE.exec(text);
  if (weaponDetail?.[1]) {
    patch.weaponsMentioned = true;
    patch.weaponsDetail = weaponDetail[1];
  }
  const suspect = SUSPECT_RE.exec(text);
  if (suspect?.[1] && suspect[1].length >= 8 && (correcting || !prior.suspectDescription?.trim())) {
    patch.suspectDescription = suspect[1].trim().slice(0, 500);
  }
  const cb = CALLBACK_RE.exec(text);
  if (cb?.[1] && (correcting || !prior.callbackNumber?.trim())) patch.callbackNumber = cb[1];
  const name = NAME_RE.exec(text);
  if (name?.[1] && (correcting || !prior.callerName?.trim())) patch.callerName = name[1];
  return merge(prior, patch);
}

const LOCATION_SLOT_KEYS = [
  "location",
  "building",
  "section",
  "NoiseLocation",
  "SuspiciousLocation",
  "VehicleLocation",
  "ParkingLocation",
  "TheftLocation",
  "WelfareCheckAddress",
  "AnimalLocation",
  "AccidentLocation",
  "VandalismLocation",
  "CodeEnforcementAddress",
  "PublicWorksLocation",
  "BurglaryVehicleLocation",
  "TowLocation",
];

const CALLBACK_SLOT_KEYS = [
  "callbackNumber",
  "CallbackNumber",
  "TheftCallbackNumber",
  "TowCallbackNumber",
  "WelfareCheckCallerCallback",
  "AccidentCallbackNumber",
];

function firstSlot(slots: Record<string, string | null | undefined>, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = slots[key]?.trim();
    if (v) return v;
  }
  return undefined;
}

function slotYes(val: string | null | undefined): boolean | undefined {
  if (!val) return undefined;
  const s = val.toLowerCase();
  if (s === "yes" || s.startsWith("y") || s === "true" || s === "1") return true;
  if (s === "no" || s.startsWith("n") || s === "false" || s === "0") return false;
  return undefined;
}

/** Map Lex slot names onto structured intake without dropping confirmed fields. */
export function mergeIntakeFromLexSlots(
  slots: Record<string, string | null | undefined>,
  prior: CallIntakeData = {},
): CallIntakeData {
  const patch: CallIntakeData = {};
  const location = firstSlot(slots, LOCATION_SLOT_KEYS);
  if (location) {
    patch.locationText = location;
    patch.locationSource = prior.locationSource ?? "CALLER";
  }
  const apt = firstSlot(slots, ["aptBusiness", "AptBusiness", "apartmentSuite"]);
  if (apt) patch.apartmentSuite = apt;
  const cross = firstSlot(slots, ["crossStreets", "CrossStreets"]);
  if (cross) patch.crossStreets = cross;
  const dir = firstSlot(slots, ["PersonDirection", "directionTravel", "directionOfTravel"]);
  if (dir) patch.directionOfTravel = dir;
  const suspect = firstSlot(slots, ["PersonDescription", "suspectDesc", "TheftSuspectInfo", "VandalismSuspectInfo"]);
  if (suspect) patch.suspectDescription = suspect.slice(0, 500);
  const callback = firstSlot(slots, CALLBACK_SLOT_KEYS);
  if (callback) patch.callbackNumber = callback;
  const caller = firstSlot(slots, ["callerName", "CallerName"]);
  if (caller) patch.callerName = caller;
  const preferred = firstSlot(slots, ["preferredLang", "PreferredLanguage", "language"]);
  if (preferred) {
    const code = normalizePreferredLanguage(preferred);
    patch.language = code;
    patch.preferredLanguage = code;
  }
  const plate = firstSlot(slots, ["licensePlate", "BurglaryVehiclePlate", "VehiclePlate"]);
  if (plate) patch.vehiclePlate = plate.toUpperCase();
  const color = firstSlot(slots, ["VehicleColor", "vehicleColor"]);
  if (color) patch.vehicleColor = color;
  const make = firstSlot(slots, ["VehicleMake", "vehicleMake"]);
  if (make) patch.vehicleMake = make;
  const model = firstSlot(slots, ["VehicleModel", "vehicleModel"]);
  if (model) patch.vehicleModel = model;
  const year = firstSlot(slots, ["VehicleYear", "vehicleYear"]);
  if (year) patch.vehicleYear = year;
  const vehicleBlob = firstSlot(slots, [
    "VehicleDescription",
    "BurglaryVehicleDescription",
    "ParkingVehicleDescription",
    "TowVehicleDescription",
    "OtherVehicleDescription",
    "vehicleDesc",
  ]);
  Object.assign(patch, parseVehicleDescription(vehicleBlob ?? "", { ...prior, ...patch }));
  const weapons = slotYes(firstSlot(slots, ["WeaponVisible", "weapons"]));
  if (weapons === true) {
    patch.weaponsMentioned = true;
    patch.weaponsDetail = firstSlot(slots, ["WeaponVisible", "weapons"]) ?? "yes";
  } else if (weapons === false) {
    patch.weaponsMentioned = false;
  }
  const injuries = slotYes(firstSlot(slots, ["AccidentInjuries", "injuries", "medicalNeeded"]));
  if (injuries === true) {
    patch.injuries = true;
    patch.injuriesDetail = firstSlot(slots, ["AccidentInjuries", "injuries", "medicalNeeded"]) ?? "yes";
  } else if (injuries === false) {
    patch.injuries = false;
  }
  const topic = firstSlot(slots, ["InformationTopic"]);
  if (topic) patch.summary = topic.slice(0, 2000);
  return merge(prior, patch);
}

export function intakeCompleteness(intake: CallIntakeData): {
  filled: string[];
  missing: string[];
} {
  const checks: Array<[string, boolean]> = [
    ["locationText", Boolean(intake.locationText?.trim())],
    ["apartmentSuite", Boolean(intake.apartmentSuite?.trim())],
    ["crossStreets", Boolean(intake.crossStreets?.trim())],
    ["directionOfTravel", Boolean(intake.directionOfTravel?.trim())],
    ["vehicleMake", Boolean(intake.vehicleMake?.trim())],
    ["vehicleModel", Boolean(intake.vehicleModel?.trim())],
    ["vehicleColor", Boolean(intake.vehicleColor?.trim())],
    ["vehiclePlate", Boolean(intake.vehiclePlate?.trim())],
    ["suspectDescription", Boolean(intake.suspectDescription?.trim())],
    ["weaponsMentioned", intake.weaponsMentioned !== undefined],
    ["injuries", intake.injuries !== undefined],
    ["preferredLanguage", Boolean(intake.preferredLanguage?.trim() || intake.language?.trim())],
  ];
  return {
    filled: checks.filter(([, ok]) => ok).map(([k]) => k),
    missing: checks.filter(([, ok]) => !ok).map(([k]) => k),
  };
}
