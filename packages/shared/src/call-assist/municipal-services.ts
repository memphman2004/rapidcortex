/**
 * Nationwide non-emergency and city-service catalog.
 *
 * A city can rename a desk, but the work is the same: a pothole is streets,
 * a missed pickup is sanitation, a dark signal is signals, a leak is water.
 * Regional issues (snow, hurricane debris, drought, wildfire ash) use the
 * same desks. Gas leaks, downed wires, and a tree on a power line are not
 * work orders.
 */

export const MUNICIPAL_DEPARTMENTS = [
  "PUBLIC_WORKS",
  "PUBLIC_WORKS_ELECTRICAL",
  "SANITATION",
  "WATER_SEWER_AUTHORITY",
  "CODE_ENFORCEMENT",
  "PARKING_ENFORCEMENT",
  "ANIMAL_CONTROL",
  "URBAN_FORESTRY",
  "PARKS_RECREATION",
  "HOUSING_COMMUNITY_DEV",
  "ENVIRONMENTAL_QUALITY",
  "POLICE_NON_EMERGENCY",
  "FIRE_MARSHAL_NON_EMERGENCY",
  "TRANSIT_AUTHORITY",
  "CITY_CLERK",
  "SOCIAL_SERVICES",
  "THREE11_OPERATIONS",
  "UTILITIES",
  "TAX_FINANCE",
  "ELECTIONS",
  "LIBRARY",
  "COURTS",
  "ESCALATE_911",
] as const;

export type MunicipalDepartmentId = (typeof MUNICIPAL_DEPARTMENTS)[number];

export type MunicipalRegion =
  | "nationwide"
  | "northeast"
  | "midwest"
  | "south"
  | "gulf"
  | "southwest"
  | "west"
  | "pacific"
  | "mountain"
  | "coastal";

export type MunicipalIssue = {
  id: string;
  departmentId: MunicipalDepartmentId;
  classification: string;
  regions: MunicipalRegion[];
  phrases: string[];
  emergencyRefer?: boolean;
};

export type MunicipalMatch = {
  issueId: string;
  departmentId: MunicipalDepartmentId;
  classification: string;
  emergencyRefer: boolean;
};

const SLA_MINUTES: Record<MunicipalDepartmentId, number> = {
  PUBLIC_WORKS: 480,
  PUBLIC_WORKS_ELECTRICAL: 240,
  SANITATION: 1440,
  WATER_SEWER_AUTHORITY: 240,
  CODE_ENFORCEMENT: 1440,
  PARKING_ENFORCEMENT: 120,
  ANIMAL_CONTROL: 60,
  URBAN_FORESTRY: 1440,
  PARKS_RECREATION: 1440,
  HOUSING_COMMUNITY_DEV: 1440,
  ENVIRONMENTAL_QUALITY: 480,
  POLICE_NON_EMERGENCY: 30,
  FIRE_MARSHAL_NON_EMERGENCY: 240,
  TRANSIT_AUTHORITY: 480,
  CITY_CLERK: 1440,
  SOCIAL_SERVICES: 240,
  THREE11_OPERATIONS: 60,
  UTILITIES: 120,
  TAX_FINANCE: 1440,
  ELECTIONS: 1440,
  LIBRARY: 1440,
  COURTS: 1440,
  ESCALATE_911: 1,
};

/** Incident types already owned by the older patrol, parking, animal, and noise rules. */
const PRESERVE_INCIDENT_TYPES = new Set([
  "SUSPICIOUS_VEHICLE",
  "SUSPICIOUS_PERSON",
  "PARKING",
  "PARKING_VIOLATION",
  "ANIMAL",
  "ANIMAL_COMPLAINT",
  "WELFARE_CHECK",
  "NOISE",
  "NOISE_COMPLAINT",
]);

/** Coarse voice classes that should still leave the supervisor queue. */
const CLASSIFICATION_DEPARTMENT: Record<string, MunicipalDepartmentId> = {
  PUBLIC_WORKS: "PUBLIC_WORKS",
  CODE_ENFORCEMENT: "CODE_ENFORCEMENT",
  ANIMAL_CONTROL: "ANIMAL_CONTROL",
  INFORMATION_REQUEST: "THREE11_OPERATIONS",
  REPORT_ONLY: "POLICE_NON_EMERGENCY",
  NON_EMERGENCY_POLICE: "POLICE_NON_EMERGENCY",
  TOW_COMPLAINT: "PARKING_ENFORCEMENT",
  ONLINE_REPORTING: "POLICE_NON_EMERGENCY",
  ONLINE_REPORTING_ELIGIBLE: "POLICE_NON_EMERGENCY",
  CARFAX: "POLICE_NON_EMERGENCY",
  CARFAX_REPORTING_ELIGIBLE: "POLICE_NON_EMERGENCY",
  EMERGENCY: "ESCALATE_911",
};

function issue(
  id: string,
  departmentId: MunicipalDepartmentId,
  classification: string,
  regions: MunicipalRegion[],
  phrases: string[],
  emergencyRefer = false,
): MunicipalIssue {
  return { id, departmentId, classification, regions, phrases, emergencyRefer };
}

export const MUNICIPAL_ISSUES: MunicipalIssue[] = [
  issue("DOWNED_WIRE", "ESCALATE_911", "EMERGENCY", ["nationwide"], [
    "downed wire",
    "wires down",
    "power line down",
    "electrical line down",
    "live wire",
  ], true),
  issue("TREE_ON_WIRE", "ESCALATE_911", "EMERGENCY", ["nationwide"], [
    "tree on the power line",
    "tree is on the power line",
    "tree on the wires",
    "tree on a wire",
    "limb on the power line",
    "branch on the power line",
  ], true),
  issue("GAS_ODOR", "ESCALATE_911", "EMERGENCY", ["nationwide"], [
    "smell of gas",
    "smell gas",
    "gas odor",
    "odor of gas",
    "exposed wire",
    "wires hanging",
    "tree touching power lines",
    "tree on power lines",
  ], true),

  issue("POTHOLE", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "pothole",
    "pot hole",
    "hole in the road",
    "hole in the street",
  ]),
  issue("SIDEWALK", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "broken sidewalk",
    "sidewalk heave",
    "uneven sidewalk",
    "sidewalk repair",
    "cracked sidewalk",
  ]),
  issue("CURB_RAMP", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "curb ramp",
    "ada ramp",
    "wheelchair ramp",
    "curb cut",
  ]),
  issue("GUARDRAIL", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "guardrail",
    "guard rail",
    "damaged railing",
  ]),
  issue("MANHOLE", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "manhole",
    "manhole cover",
    "missing manhole",
  ]),
  issue("SINKHOLE", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "sinkhole",
    "sink hole",
    "road collapse",
  ]),
  issue("RESURFACING", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "road resurfacing",
    "street paving",
    "need the road paved",
    "rough pavement",
  ]),
  issue("ALLEY", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide", "northeast", "midwest"], [
    "alley repair",
    "alley is damaged",
    "pothole in the alley",
  ]),
  issue("CROSSWALK", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "crosswalk",
    "faded crosswalk",
    "crosswalk needs paint",
    "crossing guard",
  ]),
  issue("SIGN_MISSING", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "stop sign down",
    "stop sign is down",
    "stop sign missing",
    "street sign missing",
    "street sign down",
    "yield sign down",
    "lane marking",
  ]),
  issue("ROAD_BLOCKED", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "road is blocked",
    "street is blocked",
    "blocked roadway",
    "tree blocking the road",
    "tree in the road",
    "tree across the road",
    "tree down in the street",
    "tree is down in the street",
    "tree fell in the road",
    "fallen tree blocking",
    "road blocked by debris",
  ]),
  issue("SNOW_PLOW", "PUBLIC_WORKS", "PUBLIC_WORKS", ["northeast", "midwest", "mountain"], [
    "snow plow",
    "wasn't plowed",
    "not plowed",
    "need plowing",
    "salt the road",
    "ice on the street",
    "snow emergency route",
    "snowed in by the plow",
    "snow not plowed",
    "street not plowed",
    "ice not salted",
  ]),
  issue("CATCH_BASIN", "WATER_SEWER_AUTHORITY", "PUBLIC_WORKS", ["nationwide"], [
    "catch basin",
    "storm drain",
    "clogged drain",
    "drain is clogged",
    "storm sewer",
  ]),
  issue("STREET_FLOOD", "WATER_SEWER_AUTHORITY", "PUBLIC_WORKS", ["nationwide", "gulf", "southwest"], [
    "street is flooded",
    "road is flooded",
    "standing water in the street",
    "monsoon flooding",
    "wash is flooded",
  ]),
  issue("WATER_MAIN", "WATER_SEWER_AUTHORITY", "PUBLIC_WORKS", ["nationwide"], [
    "water main",
    "water main break",
    "broken water main",
    "water bubbling",
    "water coming out of the street",
  ]),
  issue("SEWER", "WATER_SEWER_AUTHORITY", "PUBLIC_WORKS", ["nationwide"], [
    "sewer backup",
    "sewer smell",
    "sewage",
    "sewer overflow",
  ]),
  issue("HYDRANT_WATER", "WATER_SEWER_AUTHORITY", "PUBLIC_WORKS", ["nationwide"], [
    "hydrant leaking",
    "hydrant is open",
    "open hydrant",
    "hydrant flushing",
    "leaking hydrant",
  ]),
  issue("WATER_SERVICE", "WATER_SEWER_AUTHORITY", "PUBLIC_WORKS", ["nationwide", "west", "southwest"], [
    "low water pressure",
    "no water",
    "dirty water",
    "brown water",
    "water shutoff",
    "water shut off",
    "boil water",
    "watering restriction",
    "drought restriction",
    "odd even watering",
  ]),
  issue("WATER_BILL", "TAX_FINANCE", "INFORMATION_REQUEST", ["nationwide"], [
    "water bill",
    "utility bill",
    "pay my water bill",
  ]),

  issue("STREETLIGHT", "PUBLIC_WORKS_ELECTRICAL", "PUBLIC_WORKS", ["nationwide"], [
    "street light",
    "streetlight",
    "street lamp",
    "light pole",
    "street lights are out",
    "streetlight is out",
    "dark street",
  ]),
  issue("TRAFFIC_SIGNAL", "PUBLIC_WORKS_ELECTRICAL", "PUBLIC_WORKS", ["nationwide"], [
    "traffic light",
    "traffic signal",
    "stop light",
    "signal is dark",
    "signal is flashing",
    "light is stuck on red",
    "light is stuck on green",
    "traffic light is out",
    "stuck on red",
  ]),
  issue("POWER_OUTAGE", "UTILITIES", "INFORMATION_REQUEST", ["nationwide"], [
    "power outage",
    "power is out",
    "no electricity",
    "electricity is out",
    "the power went out",
  ]),

  issue("MISSED_TRASH", "SANITATION", "PUBLIC_WORKS", ["nationwide"], [
    "missed trash",
    "missed garbage",
    "missed pickup",
    "trash not picked up",
    "garbage not picked up",
    "didn't pick up the trash",
    "rubbish not collected",
    "missed garbage",
    "missed the garbage",
    "missed the trash",
    "no trash pickup",
    "blue bin not picked up",
  ]),
  issue("RECYCLING", "SANITATION", "PUBLIC_WORKS", ["nationwide"], [
    "missed recycling",
    "recycling not picked up",
    "recycling bin",
  ]),
  issue("YARD_WASTE", "SANITATION", "PUBLIC_WORKS", ["nationwide"], [
    "yard waste",
    "brush pickup",
    "leaf collection",
    "christmas tree pickup",
    "christmas tree recycling",
  ]),
  issue("BULK_TRASH", "SANITATION", "PUBLIC_WORKS", ["nationwide", "south"], [
    "bulk trash",
    "bulk pickup",
    "mattress on the curb",
    "couch on the curb",
    "bulk item",
  ]),
  issue("DUMPSTER", "SANITATION", "PUBLIC_WORKS", ["nationwide"], [
    "dumpster overflowing",
    "overflowing dumpster",
    "city dumpster",
  ]),
  issue("LITTER", "SANITATION", "PUBLIC_WORKS", ["nationwide"], [
    "litter",
    "trash in the street",
    "shopping cart",
    "illegal dumping",
  ]),
  issue("STORM_DEBRIS", "SANITATION", "PUBLIC_WORKS", ["gulf", "south", "coastal", "northeast"], [
    "hurricane debris",
    "storm debris",
    "flood debris",
    "debris pickup",
  ]),
  issue("WILDFIRE_ASH", "SANITATION", "PUBLIC_WORKS", ["west", "pacific", "mountain"], [
    "wildfire ash",
    "ash cleanup",
    "ash on the street",
  ]),
  issue("DEAD_ANIMAL_ROAD", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "dead animal in the road",
    "dead animal in the street",
    "dead deer in the road",
  ]),

  issue("STRAY_ANIMAL", "ANIMAL_CONTROL", "ANIMAL_CONTROL", ["nationwide"], [
    "stray dog",
    "stray cat",
    "loose dog",
    "dog at large",
    "found a dog",
    "lost dog",
    "barking dog",
    "dog barking",
    "dog wont stop barking",
    "dead animal",
    "animal bite",
  ]),
  issue("WILDLIFE", "ANIMAL_CONTROL", "ANIMAL_CONTROL", ["nationwide", "west", "mountain", "southwest"], [
    "raccoon",
    "skunk",
    "opossum",
    "coyote",
    "bear in",
    "mountain lion",
    "deer in the yard",
    "bat in the house",
    "snake in",
    "fox in",
  ]),
  issue("STINGING_INSECT", "ANIMAL_CONTROL", "ANIMAL_CONTROL", ["nationwide", "south", "southwest"], [
    "wasp nest",
    "hornet nest",
    "bees in the wall",
    "bee hive",
  ]),

  issue("TREE_SERVICE", "URBAN_FORESTRY", "PUBLIC_WORKS", ["nationwide", "south", "northeast"], [
    "tree down",
    "tree is down",
    "dead tree",
    "tree trimming",
    "trim the tree",
    "hanging branch",
    "broken limb",
    "stump removal",
    "tree roots",
  ]),
  issue("OVERGROWTH", "CODE_ENFORCEMENT", "CODE_ENFORCEMENT", ["nationwide", "south"], [
    "tall grass",
    "high weeds",
    "overgrown lot",
    "weeds in the lot",
    "grass not cut",
    "sidewalk not shoveled",
    "didn't shovel",
    "ice on the sidewalk",
  ]),
  issue("VACANT_PROPERTY", "CODE_ENFORCEMENT", "CODE_ENFORCEMENT", ["nationwide"], [
    "vacant building",
    "vacant house",
    "abandoned building",
    "boarded up house",
    "open vacant",
  ]),
  issue("JUNK_PROPERTY", "CODE_ENFORCEMENT", "CODE_ENFORCEMENT", ["nationwide"], [
    "junk in the yard",
    "junk vehicle",
    "inoperable vehicle",
    "blowing dust",
    "dust from the lot",
  ]),
  issue("UNPERMITTED_WORK", "CODE_ENFORCEMENT", "CODE_ENFORCEMENT", ["nationwide"], [
    "building without a permit",
    "unpermitted construction",
    "illegal addition",
    "work without a permit",
  ]),
  issue("SHORT_TERM_RENTAL", "CODE_ENFORCEMENT", "CODE_ENFORCEMENT", ["nationwide"], [
    "short term rental",
    "short-term rental",
    "airbnb",
    "vacation rental",
  ]),
  issue("GRAFFITI", "PUBLIC_WORKS", "PUBLIC_WORKS", ["nationwide"], [
    "graffiti",
    "spray paint",
    "tagging on",
  ]),

  issue("PARKING_METER", "PARKING_ENFORCEMENT", "PARKING", ["nationwide"], [
    "parking meter",
    "meter is broken",
    "meter not working",
    "pay station",
  ]),
  issue("PARKING_PERMIT", "PARKING_ENFORCEMENT", "PARKING", ["nationwide"], [
    "parking permit",
    "residential permit",
    "guest parking pass",
  ]),
  issue("TOW", "PARKING_ENFORCEMENT", "TOW_COMPLAINT", ["nationwide"], [
    "my car was towed",
    "where is my car",
    "impound lot",
    "vehicle was towed",
  ]),
  issue("ABANDONED_VEHICLE", "PARKING_ENFORCEMENT", "PARKING", ["nationwide"], [
    "abandoned car",
    "abandoned vehicle",
    "car has been sitting",
    "vehicle sitting for",
  ]),
  issue("SNOW_PARKING", "PARKING_ENFORCEMENT", "PARKING", ["northeast", "midwest"], [
    "snow emergency parking",
    "parking ban",
    "street sweeping ticket",
  ]),
  issue("PARKING_TICKET", "PARKING_ENFORCEMENT", "PARKING", ["nationwide"], [
    "parking ticket",
    "parking citation",
  ]),

  issue("NOISE_PARTY", "POLICE_NON_EMERGENCY", "NOISE_COMPLAINT", ["nationwide"], [
    "loud party",
    "loud music",
    "neighbors are loud",
  ]),
  issue("THEFT_REPORT", "POLICE_NON_EMERGENCY", "REPORT_ONLY", ["nationwide"], [
    "package was stolen",
    "package stolen",
    "mail was stolen",
    "mail stolen",
    "catalytic converter",
    "car was broken into",
    "theft already happened",
    "stolen yesterday",
  ]),
  issue("TRAFFIC_COMPLAINT", "POLICE_NON_EMERGENCY", "NON_EMERGENCY_POLICE", ["nationwide"], [
    "cars are speeding",
    "speeding on my street",
    "dirt bike",
    "atv on the street",
    "loud exhaust",
    "racing at night",
  ]),
  issue("COMMUNITY_POLICE", "POLICE_NON_EMERGENCY", "NON_EMERGENCY_POLICE", ["nationwide"], [
    "extra patrol",
    "more patrols",
    "drug dealing",
    "loitering",
    "chronic trespassing",
    "property dispute",
    "status of my case",
    "police report i filed",
  ]),
  issue("CONSTRUCTION_NOISE", "CODE_ENFORCEMENT", "CODE_ENFORCEMENT", ["nationwide"], [
    "construction noise",
    "construction too loud",
    "leaf blower too early",
    "jackhammer",
  ]),
  issue("WELFARE", "POLICE_NON_EMERGENCY", "NON_EMERGENCY_POLICE", ["nationwide"], [
    "welfare check",
    "check on my neighbor",
    "haven't seen my neighbor",
  ]),

  issue("BLOCKED_HYDRANT", "FIRE_MARSHAL_NON_EMERGENCY", "INFORMATION_REQUEST", ["nationwide"], [
    "hydrant is blocked",
    "blocked hydrant",
    "hydrant blocked by",
  ]),
  issue("FIRE_LANE", "FIRE_MARSHAL_NON_EMERGENCY", "INFORMATION_REQUEST", ["nationwide"], [
    "fire lane",
    "fire lane is blocked",
  ]),
  issue("OPEN_BURN", "FIRE_MARSHAL_NON_EMERGENCY", "INFORMATION_REQUEST", ["nationwide", "west", "south"], [
    "burning trash",
    "open burning",
    "illegal burn",
    "burn permit",
  ]),
  issue("FIRE_SAFETY_INFO", "FIRE_MARSHAL_NON_EMERGENCY", "INFORMATION_REQUEST", ["nationwide", "west"], [
    "smoke detector",
    "smoke alarm",
    "fire extinguisher",
    "fire escape is blocked",
    "fire safety",
    "red flag warning",
  ]),

  issue("PARK_MAINTENANCE", "PARKS_RECREATION", "PUBLIC_WORKS", ["nationwide"], [
    "park bathroom",
    "playground",
    "broken swing",
    "park bench",
    "tennis court",
    "dog park",
    "trail maintenance",
    "park lights",
  ]),
  issue("RECREATION", "PARKS_RECREATION", "INFORMATION_REQUEST", ["nationwide", "coastal"], [
    "pool hours",
    "recreation program",
    "sign up for camp",
    "beach hours",
    "beach closed",
    "marina",
  ]),

  issue("HOUSING_COMPLAINT", "HOUSING_COMMUNITY_DEV", "CODE_ENFORCEMENT", ["nationwide"], [
    "landlord",
    "no heat in my apartment",
    "rental inspection",
    "mold in the apartment",
    "section 8",
    "public housing",
    "eviction help",
    "unsafe apartment",
  ]),
  issue("RODENT", "ENVIRONMENTAL_QUALITY", "CODE_ENFORCEMENT", ["nationwide"], [
    "rats",
    "rat infestation",
    "mice infestation",
    "rodents",
    "bed bugs",
    "bedbugs",
    "mosquito",
    "mosquitos",
    "lead paint",
  ]),
  issue("ENCAMPMENT", "SOCIAL_SERVICES", "INFORMATION_REQUEST", ["nationwide", "west", "pacific"], [
    "homeless encampment",
    "encampment",
    "person sleeping outside",
    "people living in tents",
    "outreach team",
  ]),
  issue("SOCIAL_HELP", "SOCIAL_SERVICES", "INFORMATION_REQUEST", ["nationwide", "northeast", "midwest"], [
    "food assistance",
    "food pantry",
    "rent assistance",
    "help paying rent",
    "senior services",
    "senior center",
    "heating assistance",
    "help with my heating bill",
    "mental health services",
    "domestic violence resources",
    "disability services",
  ]),

  issue("BUS_STOP", "TRANSIT_AUTHORITY", "INFORMATION_REQUEST", ["nationwide"], [
    "bus stop",
    "bus stop sign",
    "bus shelter",
    "bus is late",
    "bike share",
    "scooter on the sidewalk",
    "e-bike",
    "paratransit",
  ]),

  issue("PERMITS", "CITY_CLERK", "INFORMATION_REQUEST", ["nationwide"], [
    "building permit",
    "business license",
    "permit status",
    "schedule an inspection",
    "certificate of occupancy",
    "zoning",
    "garage sale permit",
    "block party",
    "film permit",
    "parade permit",
    "vendor permit",
  ]),
  issue("VITAL_RECORDS", "CITY_CLERK", "INFORMATION_REQUEST", ["nationwide"], [
    "birth certificate",
    "death certificate",
    "marriage license",
    "public records request",
  ]),
  issue("CITY_HOURS", "THREE11_OPERATIONS", "INFORMATION_REQUEST", ["nationwide"], [
    "city hall hours",
    "hours for city hall",
    "when is city hall open",
  ]),
  issue("REQUEST_STATUS", "THREE11_OPERATIONS", "INFORMATION_REQUEST", ["nationwide"], [
    "status of my request",
    "service request number",
    "reopen my request",
    "i already reported this",
    "confirmation number",
  ]),
  issue("PROPERTY_TAX", "TAX_FINANCE", "INFORMATION_REQUEST", ["nationwide"], [
    "property tax",
    "tax bill",
    "tax assessment",
  ]),
  issue("ELECTIONS", "ELECTIONS", "INFORMATION_REQUEST", ["nationwide"], [
    "register to vote",
    "where do i vote",
    "polling place",
    "voter registration",
  ]),
  issue("LIBRARY", "LIBRARY", "INFORMATION_REQUEST", ["nationwide"], [
    "library hours",
    "library card",
    "public library",
  ]),
  issue("COURT", "COURTS", "INFORMATION_REQUEST", ["nationwide"], [
    "jury duty",
    "traffic court",
    "court date",
  ]),
];

export function municipalSlaMinutes(departmentId: string): number {
  return SLA_MINUTES[departmentId as MunicipalDepartmentId] ?? 240;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function phraseHits(haystack: string, phrase: string): boolean {
  const normalized = normalize(phrase);
  if (!normalized) return false;
  if (normalized.includes(" ")) return ` ${haystack} `.includes(` ${normalized} `);
  return new RegExp(`\\b${normalized}\\b`).test(haystack);
}

/** Longest matching phrase wins, so "tree on the power line" beats "tree down". */
export function classifyMunicipalIssue(text: string): MunicipalMatch | null {
  const haystack = normalize(text);
  if (!haystack) return null;
  let best: { issue: MunicipalIssue; length: number } | null = null;
  for (const issue of MUNICIPAL_ISSUES) {
    for (const phrase of issue.phrases) {
      if (!phraseHits(haystack, phrase)) continue;
      const length = normalize(phrase).length;
      if (!best || length > best.length) best = { issue, length };
    }
  }
  if (!best) return null;
  return {
    issueId: best.issue.id,
    departmentId: best.issue.departmentId,
    classification: best.issue.classification,
    emergencyRefer: best.issue.emergencyRefer === true,
  };
}

export type MunicipalRouteOverride =
  | { kind: "preserve" }
  | { kind: "emergency" }
  | { kind: "issue"; issueId: string; departmentId: MunicipalDepartmentId }
  | { kind: "classification"; departmentId: MunicipalDepartmentId }
  | { kind: "none" };

/** Lex intent name → the desk that owns that category when the caller was not more specific. */
export const LEX_INTENT_DEPARTMENT: Record<string, MunicipalDepartmentId> = {
  ReportRoadsInfrastructure: "PUBLIC_WORKS",
  ReportStreetLighting: "PUBLIC_WORKS_ELECTRICAL",
  ReportTrafficSignsMarkings: "PUBLIC_WORKS",
  ReportSanitationWaste: "SANITATION",
  ReportWaterSewerDrainage: "WATER_SEWER_AUTHORITY",
  ReportNoiseComplaint: "CODE_ENFORCEMENT",
  ReportVehicleIssue: "PARKING_ENFORCEMENT",
  ReportGraffitiVandalism: "PUBLIC_WORKS",
  ReportAnimalsPests: "ANIMAL_CONTROL",
  ReportTreesVegetation: "URBAN_FORESTRY",
  ReportParksPublicSpaces: "PARKS_RECREATION",
  ReportBuildingsHousing: "CODE_ENFORCEMENT",
  ReportHomelessSocialServices: "SOCIAL_SERVICES",
  ReportEnvironmentalHealth: "ENVIRONMENTAL_QUALITY",
  ReportLawEnforcementNonEmergency: "POLICE_NON_EMERGENCY",
  ReportFireEMSNonEmergency: "FIRE_MARSHAL_NON_EMERGENCY",
  ReportTransitIssue: "TRANSIT_AUTHORITY",
  RequestGovernmentInformation: "THREE11_OPERATIONS",
  ReportSpecialEventIssue: "CITY_CLERK",
  CheckServiceRequestStatus: "THREE11_OPERATIONS",
  TransferToLiveAgent: "THREE11_OPERATIONS",
  RedirectToEmergencyServices: "ESCALATE_911",
};

/**
 * Lex sub-issue codes. Exceptions move a code off its category desk:
 * a blocked hydrant is the fire marshal, a water bill is finance,
 * dog barking is animal control, exposed wiring is not a streetlight ticket.
 */
export const SERVICE_CODE_DEPARTMENT: Record<string, MunicipalDepartmentId> = Object.fromEntries([
  ...desk("PUBLIC_WORKS", [
    "POTHOLE", "SINKHOLE", "CRACKED_PAVEMENT", "DAMAGED_SIDEWALK", "MISSING_MANHOLE_COVER",
    "RAISED_MANHOLE_COVER", "BRIDGE_DAMAGE", "GUARDRAIL_DAMAGE", "DAMAGED_CURB_CUT",
    "SNOW_ICE_REMOVAL", "ALLEY_REPAIR", "ALLEY_CLEANING", "DEBRIS_IN_ROADWAY",
    "DEAD_ANIMAL_IN_ROAD", "CONSTRUCTION_ZONE_ISSUE", "UNLICENSED_EXCAVATION", "ROAD_HAZARD",
    "MISSING_STOP_SIGN", "MISSING_YIELD_SIGN", "MISSING_STREET_SIGN", "DAMAGED_SIGN",
    "FADED_SIGN", "WRONG_SIGN_POSTED", "MISSING_SPEED_LIMIT_SIGN", "FADED_CROSSWALK",
    "FADED_LANE_MARKINGS", "MISSING_BIKE_LANE_MARKING", "MISSING_SCHOOL_ZONE_MARKS",
    "MISSING_NO_PARKING_MARKS", "TEMPORARY_SIGN_BLOCKING", "FALLEN_TREE_ROAD",
    "PEDESTRIAN_BRIDGE_ISSUE", "GRAFFITI_PUBLIC_BUILDING", "GRAFFITI_BRIDGE",
    "GRAFFITI_PRIVATE_PROPERTY", "GRAFFITI_UTILITY_BOX", "VANDALIZED_STREET_FURN",
  ]),
  ...desk("WATER_SEWER_AUTHORITY", [
    "MISSING_GRATE", "STREET_FLOODING", "STANDING_WATER", "WATER_MAIN_BREAK", "WATER_MAIN_LEAK",
    "LEAKING_FIRE_HYDRANT", "BROKEN_FIRE_HYDRANT", "LOW_WATER_PRESSURE", "NO_WATER_SERVICE",
    "WATER_QUALITY_COLOR", "WATER_QUALITY_ODOR", "SEWER_BACKUP_PUBLIC", "SEWER_ODOR_COMPLAINT",
    "OPEN_SEWER_CAP", "STORM_DRAIN_BLOCKED", "FLOODED_UNDERPASS", "STORMWATER_RUNOFF",
    "WATER_METER_DISPUTE", "SEPTIC_OVERFLOW_PUBLIC",
  ]),
  ...desk("PUBLIC_WORKS_ELECTRICAL", [
    "STREETLIGHT_OUT_SINGLE", "STREETLIGHT_OUT_MULTIPLE", "STREETLIGHT_ON_DAYTIME",
    "STREETLIGHT_FLICKERING", "DAMAGED_LIGHT_POLE", "LEANING_POLE", "TRAFFIC_SIGNAL_LIGHT_OUT",
    "TRAFFIC_SIGNAL_ALL_DARK", "SIGNAL_WRONG_SEQUENCE", "SIGNAL_TIMING_COMPLAINT",
    "SIGNAL_DAMAGED", "PEDESTRIAN_SIGNAL_ISSUE", "CROSSWALK_BUTTON_BROKEN", "FLASHING_LIGHT_ISSUE",
  ]),
  ...desk("ESCALATE_911", ["EXPOSED_WIRING_ON_POLE"]),
  ...desk("SANITATION", [
    "MISSED_GARBAGE_PICKUP", "MISSED_RECYCLING_PICKUP", "MISSED_BULK_PICKUP",
    "MISSED_YARD_WASTE_PICKUP", "OVERFLOWING_PUBLIC_TRASH", "OVERFLOWING_RECYCLING_BIN",
    "ILLEGAL_DUMPING", "DUMPED_FURNITURE_APPLIANCE", "COMMERCIAL_WASTE_VIOLATION",
    "RECYCLING_CONTAMINATION", "REQUEST_EXTRA_BIN", "DAMAGED_CITY_BIN", "STOLEN_CITY_BIN",
    "DEAD_ANIMAL_PICKUP", "DEAD_BIRD_PICKUP", "DEAD_RODENT_PICKUP", "COMPOSTING_INQUIRY",
    "EWASTE_DISPOSAL", "HAZARDOUS_WASTE_DISPOSAL", "MEDICATION_DROPOFF", "TIRE_DISPOSAL",
    "CONSTRUCTION_DEBRIS_DUMPED", "LITTER_COMPLAINT", "DUMPSTER_COMPLIANCE",
    "ABANDONED_BELONGINGS", "BROKEN_PUBLIC_TRASH_CAN",
  ]),
  ...desk("CODE_ENFORCEMENT", [
    "CONSTRUCTION_NOISE", "COMMERCIAL_HVAC_NOISE", "LANDSCAPING_NOISE", "PILE_DRIVING",
    "GARBAGE_TRUCK_HOURS", "ABANDONED_VEHICLE_PRIVATE", "VEHICLE_PARKED_ON_LAWN",
    "OVERGROWN_VACANT_LOT", "ABANDONED_BUILDING", "UNSECURED_VACANT_BUILDING",
    "OVERGROWN_ABANDONED_LOT", "TRASH_ON_PRIVATE_PROP", "EXTERIOR_MAINTENANCE_VIOL",
    "CRUMBLING_EXTERIOR", "BROKEN_WINDOWS_VACANT", "ILLEGAL_CONVERSION",
    "UNPERMITTED_CONSTRUCTION", "UNPERMITTED_DEMOLITION", "UNSAFE_FENCE_RETAINING",
    "ILLEGAL_SIGNAGE", "SCAFFOLDING_ISSUE", "OUTDOOR_STORAGE_VIOLATION",
    "CODE_COMPLIANCE_ENFORCE",
  ]),
  ...desk("POLICE_NON_EMERGENCY", [
    "LOUD_MUSIC_RESIDENTIAL", "LOUD_MUSIC_COMMERCIAL", "LOUD_PARTY_DAYTIME",
    "LOUD_PARTY_NIGHTTIME", "VEHICLE_NOISE_EXHAUST", "CAR_ALARM", "ILLEGAL_FIREWORKS",
    "AMPLIFIED_STREET_PERF", "ICE_CREAM_TRUCK", "GANG_TAGGING", "WELFARE_CHECK_REQUEST",
    "CHRONIC_DRUG_ACTIVITY", "CHRONIC_LOITERING", "CHRONIC_TRESPASSING", "CHRONIC_SPEEDING",
    "RECKLESS_DRIVING_PAST", "ILLEGAL_STREET_RACING", "ILLEGAL_ATV_DIRTBIKE",
    "LOUD_EXHAUST_MOD", "PACKAGE_MAIL_THEFT_PAST", "PROPERTY_VANDALISM_PAST",
    "PROPERTY_DISPUTE", "EXTRA_PATROL_REQUEST", "POLICE_REPORT_STATUS",
    "INVESTIGATION_STATUS", "CHRONIC_NEIGHBOR_DISPUTE", "CURFEW_VIOLATION",
    "COPPER_CATALYTIC_THEFT", "STADIUM_TRAFFIC_COMPLAINT",
  ]),
  ...desk("ANIMAL_CONTROL", [
    "DOG_BARKING", "LIVESTOCK_ROOSTER_NOISE", "STRAY_DOG_AT_LARGE", "STRAY_CAT_COLONY",
    "DOG_BITE_FOLLOWUP", "VICIOUS_DOG_COMPLAINT", "ANIMAL_NEGLECT", "ANIMAL_CRUELTY",
    "UNLICENSED_DOG", "DOG_OFF_LEASH_VIOLATION", "ROAMING_LIVESTOCK", "WILDLIFE_RACCOON",
    "WILDLIFE_COYOTE", "WILDLIFE_OTHER", "INJURED_WILDLIFE", "SNAKE_ON_PROPERTY",
    "BEE_SWARM_PUBLIC", "WASP_HORNET_NEST", "PIGEON_NUISANCE", "DOG_IN_NON_DOG_PARK",
  ]),
  ...desk("ENVIRONMENTAL_QUALITY", [
    "RODENT_INFESTATION", "RODENT_BAITING_REQUEST", "MOSQUITO_STANDING_WATER",
    "MOSQUITO_CONTROL_REQUEST", "ILLEGAL_STORM_DRAIN_DUMP", "AIR_QUALITY_ODOR",
    "AIR_QUALITY_SMOKE", "ASBESTOS_CONCERN", "HAZARDOUS_SPILL_SMALL", "OIL_IN_STORM_DRAIN",
    "FUEL_SPILL_NO_FIRE", "ILLEGAL_CHEMICAL_DUMPING", "MOLD_PUBLIC_BUILDING",
    "WATERWAY_CONCERN", "STAGNANT_WATER_MOSQUITO", "RESTAURANT_SANITATION",
    "UNLICENSED_FOOD_VENDOR", "GARBAGE_SMELL_BUSINESS", "DEAD_ANIMAL_ODOR",
    "SHARPS_DEBRIS", "LEAD_PAINT_CONCERN",
  ]),
  ...desk("PARKING_ENFORCEMENT", [
    "ABANDONED_VEHICLE_STREET", "VEHICLE_BLOCKING_DRIVEWAY", "VEHICLE_BLOCKING_SIDEWALK",
    "VEHICLE_IN_BUS_STOP", "VEHICLE_IN_BIKE_LANE", "VEHICLE_BLOCKING_CROSSWALK",
    "DOUBLE_PARKED", "OVERSIZED_VEHICLE_RESID", "RV_CAMPER_LONG_TERM",
    "COMMERCIAL_TRUCK_OVERNIGHT", "UNLICENSED_VEHICLE", "INOPERABLE_VEHICLE",
    "EXPIRED_REGISTRATION", "ILLEGAL_ACCESSIBLE_SPACE", "TOWING_ZONE_VIOLATION",
    "MISSING_LICENSE_PLATE", "VANDALIZED_PARKING_METER", "PARKING_METER_BROKEN",
    "PARKING_PERMIT_INQUIRY", "TOW_INQUIRY", "NO_PARKING_SIGN_DISPUTE",
  ]),
  ...desk("FIRE_MARSHAL_NON_EMERGENCY", [
    "VEHICLE_BLOCKING_HYDRANT", "ILLEGAL_OPEN_BURNING", "FIRE_HAZARD_COMPLAINT",
    "BLOCKED_FIRE_HYDRANT_VEG", "BLOCKED_FIRE_LANE", "ILLEGAL_FIREWORKS_STORAGE",
    "OUTDOOR_BURN_NO_PERMIT", "SMOKE_DETECTOR_REQUEST", "CO_DETECTOR_INQUIRY",
    "FIRE_EXTINGUISHER_INFO", "FIRE_SAFETY_EDUCATION", "FIRE_STATION_INFO",
    "OPEN_PIT_EXCAVATION", "BLOCKED_FIRE_ESCAPE", "FIREWORKS_PERMIT",
  ]),
  ...desk("URBAN_FORESTRY", [
    "SIGN_OBSTRUCTED_BY_TREE", "FALLEN_TREE_SIDEWALK", "DOWNED_BRANCH",
    "TREE_OVERHANGING_ROAD", "ROOTS_DAMAGING_SIDEWALK", "DEAD_STREET_TREE",
    "TREE_TRIMMING_REQUEST", "TREE_REMOVAL_REQUEST", "OVERGROWN_SIGN_COVERAGE",
    "OVERGROWN_SIDEWALK_BLOCK", "OVERGROWN_SIGHT_LINE", "STUMP_GRINDING_REQUEST",
    "INVASIVE_SPECIES_REPORT", "NEW_TREE_PLANTING_REQUEST", "STORM_TREE_DAMAGE",
  ]),
  ...desk("PARKS_RECREATION", [
    "IRRIGATION_LEAK_PUBLIC", "FOUNTAIN_SPLASH_PAD_ISSUE", "GRAFFITI_PARK_EQUIPMENT",
    "VANDALIZED_PARK_EQUIPMENT", "BROKEN_PUBLIC_BENCH", "BROKEN_PLAYGROUND_EQUIP",
    "UNSAFE_PLAYGROUND_SURFACE", "PARK_LIGHT_OUT", "PARK_RESTROOM_LOCKED",
    "PARK_RESTROOM_UNSANITARY", "PARK_RESTROOM_VANDALIZED", "PARK_FOUNTAIN_BROKEN",
    "PARK_IRRIGATION_ISSUE", "PARK_OVERGROWN", "COURT_SURFACE_DAMAGED", "TRAIL_DAMAGED",
    "BEACH_HAZARD", "PARK_NOISE_COMPLAINT", "UNAUTHORIZED_PARK_EVENT",
    "PARK_GATE_INACCESSIBLE", "SPLASH_PAD_NOT_WORKING", "OUTDOOR_FITNESS_DAMAGED",
    "SKATE_PARK_DAMAGE", "VANDALIZED_PUBLIC_ART",
  ]),
  ...desk("HOUSING_COMMUNITY_DEV", [
    "OVERCROWDING_COMPLAINT", "NO_HEAT_TENANT", "NO_HOT_WATER_TENANT",
    "PEST_INFESTATION_TENANT", "MOLD_COMPLAINT", "UNSAFE_CONDITIONS_TENANT", "ELEVATOR_OUTAGE",
  ]),
  ...desk("SOCIAL_SERVICES", [
    "UNAUTHORIZED_PARK_CAMPING", "ENCAMPMENT_SIDEWALK", "ENCAMPMENT_BRIDGE",
    "ENCAMPMENT_PARK", "ENCAMPMENT_NEAR_SCHOOL", "ENCAMPMENT_TRANSIT",
    "INDIVIDUAL_IN_DOORWAY", "OUTREACH_TEAM_REQUEST", "SOCIAL_SERVICE_REFERRAL",
    "SENIOR_SERVICES", "DISABILITY_SERVICES", "FOOD_ASSISTANCE", "RENT_UTILITY_ASSISTANCE",
    "MENTAL_HEALTH_REFERRAL", "DOMESTIC_VIOLENCE_INFO", "SUBSTANCE_ABUSE_REFERRAL",
    "IMMIGRATION_SERVICES",
  ]),
  ...desk("TRANSIT_AUTHORITY", [
    "GRAFFITI_TRANSIT", "VANDALIZED_BUS_SHELTER", "VANDALIZED_BIKE_SHARE",
    "BUS_STOP_BENCH_DAMAGED", "BUS_SHELTER_DAMAGED", "BUS_SHELTER_GLASS_BROKEN",
    "BUS_STOP_SIGN_MISSING", "REALTIME_SIGN_NOT_WORKING", "BUS_LATE_CHRONIC_ROUTE",
    "BUS_ROUTE_CHANGE_INQUIRY", "BIKE_LANE_BLOCKED", "BIKE_SHARE_BROKEN",
    "SCOOTER_SIDEWALK_BLOCKING", "EBIKE_ABANDONED", "RIDESHARE_BUS_STOP",
    "PARATRANSIT_SCHEDULING", "PARATRANSIT_ELIGIBILITY", "FERRY_TERMINAL_COMPLAINT",
  ]),
  ...desk("CITY_CLERK", [
    "BUSINESS_LICENSE_APPLY", "BUSINESS_LICENSE_RENEW", "BUSINESS_LICENSE_STATUS",
    "CERTIFICATE_OF_OCCUPANCY", "ZONING_INFORMATION", "PERMIT_PROCESS_INFO",
    "BUILDING_PERMIT_STATUS", "INSPECTION_SCHEDULING", "INSPECTION_RESULT_INQUIRY",
    "VITAL_RECORDS_REQUEST", "PUBLIC_RECORDS_REQUEST", "SPECIAL_EVENT_PERMIT_APP",
    "BLOCK_PARTY_PERMIT", "FILM_PERMIT_COMPLAINT", "PARADE_MARCH_INFO",
    "VENDOR_PERMIT_EVENT", "TEMP_STRUCTURE_PERMIT",
  ]),
  ...desk("TAX_FINANCE", ["WATER_BILL_DISPUTE", "PROPERTY_TAX_INQUIRY"]),
  ...desk("ELECTIONS", ["VOTER_REGISTRATION", "POLLING_LOCATION"]),
  ...desk("COURTS", ["PAYMENT_OF_FINES", "JURY_DUTY_INQUIRY"]),
  ...desk("THREE11_OPERATIONS", [
    "PERMITTED_EVENT_NOISE", "CITY_OFFICE_HOURS_LOCATION", "CITY_COUNCIL_CONTACT",
    "LANGUAGE_ACCESS", "STREET_CLOSURE_INQUIRY", "EVENT_NOISE_COMPLAINT",
    "CHECK_SR_STATUS", "REOPEN_CLOSED_SR", "ISSUE_NOT_RESOLVED", "ESCALATE_REQUEST",
    "DUPLICATE_REQUEST_INQUIRY", "CORRECT_ADDRESS_ON_SR", "GET_SR_CONFIRMATION_NUM",
  ]),
]);

function desk(departmentId: MunicipalDepartmentId, codes: string[]): Array<[string, MunicipalDepartmentId]> {
  return codes.map((code) => [code, departmentId]);
}

/**
 * Specific police, parking, animal, and noise types keep their existing rules.
 * Spoken words win over the category. A service code or Lex intent is the
 * fallback when the words were not specific enough.
 */
export function municipalRouteOverride(
  incidentType: string | undefined,
  utterance: string | undefined,
): MunicipalRouteOverride {
  const incident = incidentType?.trim() ?? "";
  const upper = incident.toUpperCase();
  const spoken = classifyMunicipalIssue(utterance ?? "");
  if (spoken?.emergencyRefer || upper === "EMERGENCY" || upper === "REDIRECTTOEMERGENCYSERVICES") {
    return { kind: "emergency" };
  }
  if (PRESERVE_INCIDENT_TYPES.has(upper)) return { kind: "preserve" };
  if (spoken) return { kind: "issue", issueId: spoken.issueId, departmentId: spoken.departmentId };

  const coded = SERVICE_CODE_DEPARTMENT[upper];
  if (coded === "ESCALATE_911") return { kind: "emergency" };
  if (coded) return { kind: "issue", issueId: upper, departmentId: coded };

  const catalogIssue = MUNICIPAL_ISSUES.find((item) => item.id === upper);
  if (catalogIssue?.emergencyRefer) return { kind: "emergency" };
  if (catalogIssue) {
    return { kind: "issue", issueId: catalogIssue.id, departmentId: catalogIssue.departmentId };
  }

  const intent =
    LEX_INTENT_DEPARTMENT[incident] ??
    Object.entries(LEX_INTENT_DEPARTMENT).find(([name]) => name.toUpperCase() === upper)?.[1];
  if (intent === "ESCALATE_911") return { kind: "emergency" };
  if (intent) return { kind: "classification", departmentId: intent };

  const mapped = CLASSIFICATION_DEPARTMENT[upper];
  if (mapped === "ESCALATE_911") return { kind: "emergency" };
  if (mapped) return { kind: "classification", departmentId: mapped };
  return { kind: "none" };
}

export function municipalIssueIdsForDepartment(departmentId: string): string[] {
  return MUNICIPAL_ISSUES.filter((item) => item.departmentId === departmentId && !item.emergencyRefer).map(
    (item) => item.id,
  );
}
