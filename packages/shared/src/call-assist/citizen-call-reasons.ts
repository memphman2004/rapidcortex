import { NEXCORT_311_SERVICE_REGISTRY } from "./service-registry/seed.js";
import type { MunicipalDepartmentId } from "./municipal-services.js";

/** One reason a resident may call, taken from the 311 candidate list. */
export type CitizenCallReason = {
  serviceId: string;
  category: string;
  name: string;
  departmentId: MunicipalDepartmentId;
  emergencyRefer: boolean;
};

const CATEGORY_DEPARTMENT: Record<string, MunicipalDepartmentId> = {
  "Police Non-Emergency": "POLICE_NON_EMERGENCY",
  "Fire Prevention": "FIRE_MARSHAL_NON_EMERGENCY",
  "EMS Administration": "FIRE_MARSHAL_NON_EMERGENCY",
  "Streets and Public Works": "PUBLIC_WORKS",
  "Sanitation and Recycling": "SANITATION",
  "Water Sewer and Utilities": "WATER_SEWER_AUTHORITY",
  "Code Enforcement": "CODE_ENFORCEMENT",
  "Permits Planning and Zoning": "CITY_CLERK",
  "Animal Services": "ANIMAL_CONTROL",
  "Public Health": "ENVIRONMENTAL_QUALITY",
  "Environmental Services": "ENVIRONMENTAL_QUALITY",
  "Parks and Recreation": "PARKS_RECREATION",
  "Housing and Social Services": "SOCIAL_SERVICES",
  "Transit and Parking": "TRANSIT_AUTHORITY",
  "Government and Civic": "THREE11_OPERATIONS",
  "Libraries Education and Culture": "LIBRARY",
  "Emergency Preparedness": "THREE11_OPERATIONS",
  "Economic Development": "CITY_CLERK",
  "Property Tax and Land Records": "TAX_FINANCE",
  "311 Operations": "THREE11_OPERATIONS",
  "Courts and Corrections": "COURTS",
  "Consumer Protection": "CODE_ENFORCEMENT",
  "Digital and Broadband": "THREE11_OPERATIONS",
  "Airports Ports and Ferries": "TRANSIT_AUTHORITY",
  "Cemeteries and Memorials": "PARKS_RECREATION",
  "Specialized Municipal Services": "THREE11_OPERATIONS",
};

/**
 * A single common word is not enough to pick a desk. "Complaints" shows up
 * in several categories, and the caller still needs a person when that is
 * all they said.
 */
const VAGUE_REASONS = new Set([
  "complaints",
  "commendations",
  "billing",
  "records",
  "outreach",
  "appeals",
  "minutes",
  "agendas",
  "livestreams",
  "assessments",
  "accessibility",
  "delays",
  "disruptions",
  "refunds",
  "surveys",
  "interpreters",
  "donations",
  "tourism",
  "landscaping",
  "printing",
  "litter",
  "smoke",
  "trails",
  "fares",
  "procurement",
  "newsletters",
  "courtrooms",
  "restitution",
  "vandalism",
  "graffiti",
  "speeding",
  "trespassing",
]);

const KEEP_LAST_WORD = new Set(["hours", "status", "business", "address", "news", "process", "bus", "gas"]);

function includesTerm(text: string, term: string): boolean {
  return ` ${text} `.includes(` ${term} `);
}

function departmentFor(category: string, name: string): MunicipalDepartmentId {
  const text = name.toLowerCase();
  const has = (...terms: string[]) => terms.some((term) => includesTerm(text, term) || text.includes(term));
  if (category === "Streets and Public Works") {
    if (
      has(
        "streetlight",
        "traffic signal",
        "signal timing",
        "signal malfunction",
        "pedestrian signal",
        "light pole",
        "flickering street",
      )
    ) {
      return "PUBLIC_WORKS_ELECTRICAL";
    }
    if (has("fallen tree", "tree limb", "roadside vegetation", "overgrown roadside")) return "URBAN_FORESTRY";
  }
  if (category === "Water Sewer and Utilities" && has("bill", "payment", "balance")) return "TAX_FINANCE";
  if (
    category === "Housing and Social Services" &&
    has("housing", "rental", "tenant", "landlord", "eviction", "voucher", "mortgage", "foreclosure")
  ) {
    return "HOUSING_COMMUNITY_DEV";
  }
  if (category === "Transit and Parking" && has("parking", "citation", "garage", "meter")) return "PARKING_ENFORCEMENT";
  if (category === "Public Health" && has("mental health", "suicide", "crisis", "substance", "behavioral")) {
    return "SOCIAL_SERVICES";
  }
  if (category === "Environmental Services" && has("tree", "forestry", "limb")) return "URBAN_FORESTRY";
  if (category === "Government and Civic") {
    if (has("voter", "election", "polling", "absentee", "ballot")) return "ELECTIONS";
    if (has("jury", "court")) return "COURTS";
    if (has("tax", "assessment")) return "TAX_FINANCE";
    if (has("birth", "death", "marriage", "license", "notary", "ordinance", "certificate")) return "CITY_CLERK";
  }
  if (category === "Consumer Protection" && has("fraud", "scam", "identity", "gouging", "robocall", "telemarketing")) {
    return "POLICE_NON_EMERGENCY";
  }
  if (category === "Digital and Broadband" && has("pole", "cable", "fiber")) return "PUBLIC_WORKS";
  return CATEGORY_DEPARTMENT[category] ?? "THREE11_OPERATIONS";
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function phraseVariants(name: string): string[] {
  const phrase = normalize(name);
  if (!phrase || VAGUE_REASONS.has(phrase)) return [];
  const variants = [phrase];
  const parts = phrase.split(" ");
  const last = parts[parts.length - 1] ?? "";
  if (parts.length > 1 && last.length > 4 && !KEEP_LAST_WORD.has(last) && last.endsWith("s") && !last.endsWith("ss")) {
    parts[parts.length - 1] = last.slice(0, -1);
    const singular = parts.join(" ");
    if (singular !== phrase) variants.push(singular);
  }
  return variants;
}

function phraseHits(haystack: string, phrase: string): boolean {
  if (phrase.includes(" ")) return ` ${haystack} `.includes(` ${phrase} `);
  return new RegExp(`\\b${phrase}\\b`).test(haystack);
}

const CITIZEN_CALL_REASONS: readonly CitizenCallReason[] = NEXCORT_311_SERVICE_REGISTRY.services.map((service) => ({
  serviceId: service.service_id,
  category: service.category,
  name: service.service_name,
  departmentId: departmentFor(service.category, service.service_name),
  emergencyRefer: false,
}));

const PHRASES: ReadonlyArray<{ reason: CitizenCallReason; phrase: string }> = CITIZEN_CALL_REASONS.flatMap((reason) =>
  phraseVariants(reason.name).map((phrase) => ({ reason, phrase })),
);

export function listCitizenCallReasons(): readonly CitizenCallReason[] {
  return CITIZEN_CALL_REASONS;
}

export function matchCitizenCallReason(text: string): CitizenCallReason | null {
  const haystack = normalize(text);
  if (!haystack) return null;
  let best: { reason: CitizenCallReason; length: number } | null = null;
  for (const entry of PHRASES) {
    if (!phraseHits(haystack, entry.phrase)) continue;
    const length = entry.phrase.length;
    if (!best || length > best.length) best = { reason: entry.reason, length };
  }
  return best?.reason ?? null;
}

const COARSE_OR_DIFFERENT_DESK: Record<string, string> = {
  FallbackIntent: "",
  PublicWorksIssue: "PUBLIC_WORKS",
  Welcome: "",
  NoiseComplaint: "POLICE_NON_EMERGENCY",
  NonEmergencyPolice: "POLICE_NON_EMERGENCY",
  ReportOnly: "POLICE_NON_EMERGENCY",
  ParkingComplaint: "PARKING_ENFORCEMENT",
  AnimalComplaint: "ANIMAL_CONTROL",
  CodeEnforcement: "CODE_ENFORCEMENT",
  InformationRequest: "THREE11_OPERATIONS",
};

/** A listed reason replaces a guess when that guess would send the caller to a different desk. */
export function listedReasonReplacesIntent(intentName: string, departmentId: string): boolean {
  if (!(intentName in COARSE_OR_DIFFERENT_DESK)) return false;
  const current = COARSE_OR_DIFFERENT_DESK[intentName];
  return current !== departmentId;
}
