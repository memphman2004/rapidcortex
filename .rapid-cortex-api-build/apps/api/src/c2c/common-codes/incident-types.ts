/**
 * APCO-style public safety incident type codes used by the C2C hub.
 * Codes follow the category-prefix + mnemonic pattern used in APCO ANS 2.103.2-2019.
 * Agency-extended codes use an `X-` prefix and are accepted by the EIDO validator.
 */

export const INCIDENT_CATEGORIES = ["Law", "Fire", "EMS", "Traffic", "Hazmat", "Rescue", "Other"] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export interface APCOIncidentType {
  code: string;
  description: string;
  category: IncidentCategory;
}

function def(code: string, description: string, category: IncidentCategory): APCOIncidentType {
  return { code, description, category };
}

export const APCO_INCIDENT_TYPES = {
  "LA-ASLT": def("LA-ASLT", "Assault", "Law"),
  "LA-ROB": def("LA-ROB", "Robbery", "Law"),
  "LA-BURG": def("LA-BURG", "Burglary", "Law"),
  "LA-THEFT": def("LA-THEFT", "Theft / larceny", "Law"),
  "LA-SHOT": def("LA-SHOT", "Shots fired", "Law"),
  "LA-WPN": def("LA-WPN", "Weapon complaint", "Law"),
  "LA-DOM": def("LA-DOM", "Domestic disturbance", "Law"),
  "LA-DIST": def("LA-DIST", "Disturbance", "Law"),
  "LA-SUSP": def("LA-SUSP", "Suspicious person / vehicle", "Law"),
  "LA-ALR": def("LA-ALR", "Intrusion / burglar alarm", "Law"),
  "LA-WANTED": def("LA-WANTED", "Wanted person", "Law"),
  "LA-PUR": def("LA-PUR", "Pursuit", "Law"),
  "LA-TRESP": def("LA-TRESP", "Trespass", "Law"),
  "LA-VAND": def("LA-VAND", "Vandalism", "Law"),
  "LA-FRAUD": def("LA-FRAUD", "Fraud", "Law"),
  "LA-MISS": def("LA-MISS", "Missing person", "Law"),
  "LA-KIDN": def("LA-KIDN", "Kidnapping / abduction", "Law"),
  "LA-SEX": def("LA-SEX", "Sex offense", "Law"),
  "LA-HOM": def("LA-HOM", "Homicide", "Law"),
  "LA-SUIC": def("LA-SUIC", "Suicide / attempt", "Law"),
  "LA-OD": def("LA-OD", "Overdose (law response)", "Law"),
  "LA-WELF": def("LA-WELF", "Welfare check", "Law"),
  "LA-CIVIL": def("LA-CIVIL", "Civil matter", "Law"),
  "LA-NOISE": def("LA-NOISE", "Noise complaint", "Law"),
  "LA-ANIMAL": def("LA-ANIMAL", "Animal complaint", "Law"),
  "CR-ASLT": def("CR-ASLT", "Criminal assault", "Law"),
  "CR-ROB": def("CR-ROB", "Criminal robbery", "Law"),
  "CR-THEFT": def("CR-THEFT", "Criminal theft", "Law"),
  "CR-FRAUD": def("CR-FRAUD", "Criminal fraud", "Law"),
  "VP-STOP": def("VP-STOP", "Vehicle / pedestrian stop", "Law"),
  "VP-SUSP": def("VP-SUSP", "Suspicious vehicle", "Law"),
  "AS-ALR": def("AS-ALR", "Alarm (law)", "Law"),
  "AS-PANIC": def("AS-PANIC", "Panic alarm", "Law"),
  "FI-STRUC": def("FI-STRUC", "Structure fire", "Fire"),
  "FI-VEH": def("FI-VEH", "Vehicle fire", "Fire"),
  "FI-BRUSH": def("FI-BRUSH", "Brush / wildland fire", "Fire"),
  "FI-ALARM": def("FI-ALARM", "Fire alarm", "Fire"),
  "FI-SMOKE": def("FI-SMOKE", "Smoke investigation", "Fire"),
  "FI-GAS": def("FI-GAS", "Gas leak / odor", "Fire"),
  "FI-ELEC": def("FI-ELEC", "Electrical hazard", "Fire"),
  "FI-CO": def("FI-CO", "Carbon monoxide", "Fire"),
  "FI-EXP": def("FI-EXP", "Explosion", "Fire"),
  "FI-ARSON": def("FI-ARSON", "Arson investigation", "Fire"),
  "SV-ALARM": def("SV-ALARM", "Service / fire alarm", "Fire"),
  "SV-ELEV": def("SV-ELEV", "Elevator rescue", "Fire"),
  "SV-LOCK": def("SV-LOCK", "Lockout / lock-in", "Fire"),
  "SV-WATER": def("SV-WATER", "Water leak / flood", "Fire"),
  "SV-TREE": def("SV-TREE", "Tree / debris", "Fire"),
  "ME-UNC": def("ME-UNC", "Unconscious / fainting", "EMS"),
  "ME-CP": def("ME-CP", "Chest pain", "EMS"),
  "ME-DIFF": def("ME-DIFF", "Difficulty breathing", "EMS"),
  "ME-STROKE": def("ME-STROKE", "Stroke / CVA", "EMS"),
  "ME-SEIZ": def("ME-SEIZ", "Seizure", "EMS"),
  "ME-DIAB": def("ME-DIAB", "Diabetic emergency", "EMS"),
  "ME-ALLERGY": def("ME-ALLERGY", "Allergic reaction", "EMS"),
  "ME-TRAUMA": def("ME-TRAUMA", "Trauma", "EMS"),
  "ME-FALL": def("ME-FALL", "Fall", "EMS"),
  "ME-BURN": def("ME-BURN", "Burns", "EMS"),
  "ME-OB": def("ME-OB", "Obstetric emergency", "EMS"),
  "ME-PSYCH": def("ME-PSYCH", "Psychiatric emergency", "EMS"),
  "ME-OD": def("ME-OD", "Overdose / poisoning", "EMS"),
  "ME-ABD": def("ME-ABD", "Abdominal pain", "EMS"),
  "ME-BLEED": def("ME-BLEED", "Hemorrhage", "EMS"),
  "ME-CARDIAC": def("ME-CARDIAC", "Cardiac arrest", "EMS"),
  "ME-MVC": def("ME-MVC", "MVC with medical emergency", "EMS"),
  "ME-UNK": def("ME-UNK", "Unknown medical", "EMS"),
  "EM-LIFT": def("EM-LIFT", "Lift assist", "EMS"),
  "EM-TRANS": def("EM-TRANS", "Interfacility transport", "EMS"),
  "TC-MVC": def("TC-MVC", "Motor vehicle collision", "Traffic"),
  "TC-PI": def("TC-PI", "Personal injury accident", "Traffic"),
  "TC-HNR": def("TC-HNR", "Hit and run", "Traffic"),
  "TC-FAT": def("TC-FAT", "Fatal accident", "Traffic"),
  "TC-CRASH": def("TC-CRASH", "General crash", "Traffic"),
  "TC-PD": def("TC-PD", "Property damage accident", "Traffic"),
  "TC-HAZ": def("TC-HAZ", "Traffic hazard", "Traffic"),
  "TC-DISABLED": def("TC-DISABLED", "Disabled vehicle", "Traffic"),
  "TC-ROAD": def("TC-ROAD", "Road obstruction", "Traffic"),
  "TC-DUI": def("TC-DUI", "Impaired driver", "Traffic"),
  "TC-SPEED": def("TC-SPEED", "Reckless / speeding", "Traffic"),
  "MV-STOP": def("MV-STOP", "Traffic stop", "Traffic"),
  "MV-PUR": def("MV-PUR", "Vehicle pursuit", "Traffic"),
  "HM-SPILL": def("HM-SPILL", "Hazmat spill", "Hazmat"),
  "HM-LEAK": def("HM-LEAK", "Hazmat leak", "Hazmat"),
  "HM-UNK": def("HM-UNK", "Unknown hazardous material", "Hazmat"),
  "HM-CHEM": def("HM-CHEM", "Chemical incident", "Hazmat"),
  "HM-RAD": def("HM-RAD", "Radiological incident", "Hazmat"),
  "HZ-GAS": def("HZ-GAS", "Hazardous gas", "Hazmat"),
  "HZ-FUEL": def("HZ-FUEL", "Fuel spill", "Hazmat"),
  "RE-TECH": def("RE-TECH", "Technical rescue", "Rescue"),
  "RE-CONF": def("RE-CONF", "Confined space rescue", "Rescue"),
  "RE-HIGH": def("RE-HIGH", "High-angle rescue", "Rescue"),
  "RE-COLLAPSE": def("RE-COLLAPSE", "Collapse rescue", "Rescue"),
  "RE-ENTRAP": def("RE-ENTRAP", "Entrapment", "Rescue"),
  "WR-DROWN": def("WR-DROWN", "Water rescue / drowning", "Rescue"),
  "WR-BOAT": def("WR-BOAT", "Boat distress", "Rescue"),
  "WR-FLOOD": def("WR-FLOOD", "Flood rescue", "Rescue"),
  "OU-ASSIST": def("OU-ASSIST", "Agency assist", "Other"),
  "OU-INFO": def("OU-INFO", "Information only", "Other"),
  "OU-TEST": def("OU-TEST", "Test / training", "Other"),
  "OU-ADMIN": def("OU-ADMIN", "Administrative", "Other"),
  "OT-OTHER": def("OT-OTHER", "Other / unclassified", "Other"),
  "OT-UNKNOWN": def("OT-UNKNOWN", "Unknown incident type", "Other"),
} as const satisfies Record<string, APCOIncidentType>;

export type APCOIncidentTypeCode = keyof typeof APCO_INCIDENT_TYPES | (string & {});

export function isStandardApcoIncidentType(code: string): code is keyof typeof APCO_INCIDENT_TYPES {
  return Object.prototype.hasOwnProperty.call(APCO_INCIDENT_TYPES, code);
}

export function isValidIncidentTypeCode(code: string): boolean {
  if (!code) return false;
  if (code.startsWith("X-")) return code.length >= 3 && code.length <= 32;
  return isStandardApcoIncidentType(code);
}

export function incidentTypeCategory(code: string): IncidentCategory | null {
  if (isStandardApcoIncidentType(code)) return APCO_INCIDENT_TYPES[code].category;
  const prefix = code.split("-")[0];
  const prefixMap: Record<string, IncidentCategory> = {
    LA: "Law",
    CR: "Law",
    VP: "Law",
    AS: "Law",
    FI: "Fire",
    SV: "Fire",
    ME: "EMS",
    EM: "EMS",
    TC: "Traffic",
    MV: "Traffic",
    HM: "Hazmat",
    HZ: "Hazmat",
    RE: "Rescue",
    WR: "Rescue",
    OU: "Other",
    OT: "Other",
  };
  return prefixMap[prefix ?? ""] ?? null;
}
