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
const COLOR_RE = /\b(red|blue|black|white|silver|gray|grey|green|yellow|maroon|gold|brown|tan|orange|purple)\b/i;
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

export function parseVehicleDescription(text: string, prior: CallIntakeData = {}): CallIntakeData {
  const patch: CallIntakeData = {};
  const year = YEAR_RE.exec(text);
  if (year?.[1] && !prior.vehicleYear) patch.vehicleYear = year[1];
  const make = MAKE_RE.exec(text);
  if (make?.[1] && !prior.vehicleMake) patch.vehicleMake = make[1];
  const model = MODEL_RE.exec(text);
  if (model?.[1] && !prior.vehicleModel) patch.vehicleModel = model[1].replace(/\s+/g, " ");
  const color = COLOR_RE.exec(text);
  if (color?.[1] && !prior.vehicleColor) patch.vehicleColor = color[1];
  const plate = PLATE_RE.exec(text);
  if (plate?.[1] && !prior.vehiclePlate) patch.vehiclePlate = plate[1].toUpperCase();
  return patch;
}

/** Deterministic field extraction. LLM extraction may enrich later but cannot delete confirmed fields. */
export function extractIntakeFields(utterance: string, prior: CallIntakeData = {}): CallIntakeData {
  const patch: CallIntakeData = { ...parseVehicleDescription(utterance, prior) };
  const loc = LOCATION_RE.exec(utterance);
  if (loc?.[1]) {
    patch.locationText = loc[1].trim();
    patch.locationSource = prior.locationSource === "ANI_ALI" ? "ANI_ALI" : "CALLER";
  }
  const apt = APT_RE.exec(utterance);
  if (apt?.[1]) patch.apartmentSuite = apt[1].toUpperCase();
  const cross = CROSS_RE.exec(utterance) ?? AND_STREETS_RE.exec(utterance);
  if (cross) {
    patch.crossStreets = (cross[1] && cross[2] ? `${cross[1]} and ${cross[2]}` : cross[1]).trim();
  }
  const dir = DIRECTION_RE.exec(utterance);
  if (dir?.[1]) patch.directionOfTravel = dir[1].toLowerCase();
  if (/\b(happening (right )?now|still going on|in progress)\b/i.test(utterance)) patch.isInProgress = true;
  if (/\b(yesterday|last night|earlier today|already happened|not happening now)\b/i.test(utterance)) {
    patch.isInProgress = false;
  }
  const injuryDetail = INJURY_DETAIL_RE.exec(utterance);
  if (injuryDetail?.[1]) {
    patch.injuries = true;
    patch.injuriesDetail = injuryDetail[1];
  }
  if (/\bno one (is |was )?hurt\b|\bno injur/i.test(utterance)) patch.injuries = false;
  const weaponDetail = WEAPON_DETAIL_RE.exec(utterance);
  if (weaponDetail?.[1]) {
    patch.weaponsMentioned = true;
    patch.weaponsDetail = weaponDetail[1];
  }
  const suspect = SUSPECT_RE.exec(utterance);
  if (suspect?.[1] && suspect[1].length >= 8) patch.suspectDescription = suspect[1].trim().slice(0, 500);
  const cb = CALLBACK_RE.exec(utterance);
  if (cb?.[1]) patch.callbackNumber = cb[1];
  const name = NAME_RE.exec(utterance);
  if (name?.[1]) patch.callerName = name[1];
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
