export type CallIntakeData = {
  locationText?: string;
  locationLat?: number;
  locationLng?: number;
  locationSource?: "CALLER" | "ANI_ALI" | "RAPIDSOS" | "GIS" | "UNKNOWN";
  incidentTypeHint?: string;
  isInProgress?: boolean;
  injuries?: boolean;
  weaponsMentioned?: boolean;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehiclePlate?: string;
  suspectDescription?: string;
  callbackNumber?: string;
  callerName?: string;
  language?: string;
  summary?: string;
};

const LOCATION_RE = /\b(\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|ct|court|pkwy|parkway|trl|trail)\b)?[^.!?]{0,40})/i;
const PLATE_RE = /\b(?:plate|tag)\s*[:#]?\s*([A-Z0-9]{2,8})\b/i;
const CALLBACK_RE = /\b(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})\b/;
const NAME_RE = /\b(?:my name is|this is)\s+([A-Za-z][A-Za-z'-]{1,30}(?:\s+[A-Za-z][A-Za-z'-]{1,30})?)/i;

function merge(base: CallIntakeData, patch: CallIntakeData): CallIntakeData {
  const next = { ...base };
  for (const [k, v] of Object.entries(patch) as Array<[keyof CallIntakeData, CallIntakeData[keyof CallIntakeData]]>) {
    if (v !== undefined && v !== "") next[k] = v as never;
  }
  return next;
}

/** Deterministic field extraction. LLM extraction may enrich later but cannot delete confirmed fields. */
export function extractIntakeFields(utterance: string, prior: CallIntakeData = {}): CallIntakeData {
  const patch: CallIntakeData = {};
  const loc = LOCATION_RE.exec(utterance);
  if (loc?.[1]) {
    patch.locationText = loc[1].trim();
    patch.locationSource = "CALLER";
  }
  const plate = PLATE_RE.exec(utterance);
  if (plate?.[1]) patch.vehiclePlate = plate[1].toUpperCase();
  const make = /\b(ford|chevy|chevrolet|toyota|honda|nissan|dodge|jeep|bmw|mercedes|hyundai|kia|tesla|gmc|ram)\b/i.exec(utterance);
  if (make?.[1]) patch.vehicleMake = make[1];
  const color = /\b(red|blue|black|white|silver|gray|grey|green|yellow|maroon|gold)\b/i.exec(utterance);
  if (color?.[1]) patch.vehicleColor = color[1];
  if (/\b(happening (right )?now|still going on|in progress)\b/i.test(utterance)) patch.isInProgress = true;
  if (/\b(yesterday|last night|earlier today|already happened|not happening now)\b/i.test(utterance)) {
    patch.isInProgress = false;
  }
  if (/\b(hurt|injured|bleeding)\b/i.test(utterance)) patch.injuries = true;
  if (/\bno one (is |was )?hurt\b|\bno injur/i.test(utterance)) patch.injuries = false;
  if (/\b(gun|knife|weapon)\b/i.test(utterance)) patch.weaponsMentioned = true;
  const cb = CALLBACK_RE.exec(utterance);
  if (cb?.[1]) patch.callbackNumber = cb[1];
  const name = NAME_RE.exec(utterance);
  if (name?.[1]) patch.callerName = name[1];
  return merge(prior, patch);
}
