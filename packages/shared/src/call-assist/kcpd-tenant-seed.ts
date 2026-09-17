import { MISSOURI_SUNSHINE_RETENTION_POLICY, type RetentionPolicy } from "./retention.js";
import type { ExternalAgencyRoute } from "./routing.js";
import type { CadNatureMapping, CadProviderId } from "./cad-types.js";
import type { CallAssistDemoScenarioConfig } from "./taxonomy.js";
import {
  GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE,
  interpolateDemoUtterance,
  type AgencyDemoCustomizations,
  type CallAssistAgencyVoiceConfig,
} from "./voice-config.js";

/**
 * KCPD reference tenant — first agency in the system, not the product.
 * Apply only when CALL_ASSIST_SEED_PROFILE=kcpd AND agencyId matches CALL_ASSIST_SEED_AGENCY_ID.
 * Do not import this from Safety / Triage / Intake engines.
 */
export const KCPD_DISCLOSURE_TEXT =
  "You've reached the Kansas City Police Department non-emergency line. " +
  "This call may be handled initially by an automated assistant to gather " +
  "information and route your call. If this is an emergency, say 'emergency' " +
  "or hang up and dial 9-1-1.";

/** Spoken on the first-tenant Lex/Connect test DID. Stored on that tenant only. */
export const KCPD_LEX_DISCLOSURE_TEXT =
  "You are speaking with an AI assistant for the Kansas City Missouri Police Department. " +
  "This is a non-emergency line. This call is recorded.";

export const GENERIC_DISCLOSURE_TEXT = GENERIC_CALL_ASSIST_DISCLOSURE_TEMPLATE;

const LEX_DEMO_VERTICAL = { vertical: "911" as const, source: "preset" as const, enabled: true };

/** Universal Lex smoke-test shapes. Streets are placeholders, not Kansas City. */
export const CALL_ASSIST_LEX_DEMO_TEMPLATES: CallAssistDemoScenarioConfig[] = [
  {
    id: "abandoned-vehicle",
    label: "Abandoned vehicle",
    utterances: [
      "There's an abandoned vehicle on my street. White Ford pickup, plate ABC123",
      "It's been there for three days",
      "{{localStreetExample}}",
      "It's still just sitting there abandoned",
      "{{callbackExample}}",
    ],
    expectedClass: "NonEmergencyPolice",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "noise-complaint",
    label: "Noise complaint",
    utterances: ["My neighbors are having a loud party", "{{localStreetExample}}", "It's music and it's still going on", "{{callbackExample}}"],
    expectedClass: "NoiseComplaint",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "welfare-check",
    label: "Welfare check",
    utterances: [
      "I'm worried about my elderly neighbor",
      "She hasn't answered the door in two days",
      "{{localStreetExample}}",
      "Please do a welfare check",
      "{{callbackExample}}",
    ],
    expectedClass: "NonEmergencyPolice",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "parking-complaint",
    label: "Parking complaint",
    utterances: [
      "Someone is blocking my driveway",
      "{{localStreetExample}}",
      "It's a silver Toyota Camry",
      "I don't have the plate",
      "Blocking a driveway",
      "{{callbackExample}}",
    ],
    expectedClass: "ParkingComplaint",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "non-emergency-theft",
    label: "Non-emergency theft",
    utterances: [
      "I want to report a theft",
      "My package was stolen off my porch",
      "{{localStreetExample}}",
      "It already happened, nobody is hurt",
      "{{callbackExample}}",
    ],
    expectedClass: "ReportOnly",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "mid-call-emergency",
    label: "Mid-call emergency",
    utterances: ["There's a suspicious person outside", "Actually he just pulled out a gun", "I need help now"],
    expectedClass: "EmergencyEscalation",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "parking-no-plate",
    label: "Parking — no plate",
    utterances: [
      "Car blocking fire hydrant",
      "{{localStreetExample}}",
      "Red Ford pickup",
      "No I can't see the plate",
      "Fire hydrant",
      "{{callbackExample}}",
    ],
    expectedClass: "ParkingComplaint",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "spanish-noise",
    label: "Spanish noise",
    utterances: ["Hay mucho ruido en mi vecindario", "{{localStreetExample}}", "Es música y todavía está pasando", "{{callbackExample}}"],
    expectedClass: "NoiseComplaint",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "carfax-eligible",
    label: "CarFax eligible",
    utterances: [
      "My car was stolen yesterday",
      "I need a report for insurance",
      "{{localStreetExample}}",
      "Blue Honda Civic plate XYZ999",
      "Nobody was hurt",
      "{{callbackExample}}",
    ],
    expectedClass: "CarfaxReportingEligible",
    ...LEX_DEMO_VERTICAL,
  },
  {
    id: "code-enforcement",
    label: "Code enforcement",
    utterances: ["My neighbor has junk cars in their yard", "It's been months", "{{localStreetExample}}", "{{callbackExample}}"],
    expectedClass: "CodeEnforcement",
    ...LEX_DEMO_VERTICAL,
  },
];

const GENERIC_LEX_DEMO_CUSTOMIZATIONS: Record<string, AgencyDemoCustomizations> = {
  "abandoned-vehicle": { streetExample: "1200 Main Street", callbackExample: "555-0142" },
  "noise-complaint": { streetExample: "400 Oak Street apartment 3B", callbackExample: "555-0199" },
  "welfare-check": { streetExample: "12 Elm Street", callbackExample: "555-0142" },
  "parking-complaint": { streetExample: "55 Pine Street", callbackExample: "555-0142" },
  "non-emergency-theft": { streetExample: "800 Walnut Street", callbackExample: "555-0142" },
  "parking-no-plate": { streetExample: "Oak and First Street", callbackExample: "555-0142" },
  "spanish-noise": { streetExample: "4500 Calle Principal", callbackExample: "555-0142" },
  "carfax-eligible": { streetExample: "Main Street and First Avenue", callbackExample: "555-0142" },
  "code-enforcement": { streetExample: "1900 Oak Street", callbackExample: "555-0142" },
};

/** Local streets for the first tenant. Other agencies supply their own overlay. */
export const KCPD_LEX_DEMO_CUSTOMIZATIONS: Record<string, { id: string; customizations: AgencyDemoCustomizations }> = {
  "abandoned-vehicle": { id: "kcpd-01", customizations: { streetExample: "1847 Troost Avenue", callbackExample: "555-0142" } },
  "noise-complaint": {
    id: "kcpd-02",
    customizations: { streetExample: "4200 Main Street apartment 3B", callbackExample: "555-0199" },
  },
  "welfare-check": { id: "kcpd-03", customizations: { streetExample: "300 West 39th Street", callbackExample: "555-0142" } },
  "parking-complaint": { id: "kcpd-04", customizations: { streetExample: "742 Elm Street", callbackExample: "555-0142" } },
  "non-emergency-theft": { id: "kcpd-05", customizations: { streetExample: "1200 Grand Boulevard", callbackExample: "555-0142" } },
  "mid-call-emergency": { id: "kcpd-06", customizations: {} },
  "parking-no-plate": { id: "kcpd-07", customizations: { streetExample: "Oak and 31st Street", callbackExample: "555-0142" } },
  "spanish-noise": { id: "kcpd-08", customizations: { streetExample: "4500 Calle Broadway", callbackExample: "555-0142" } },
  "carfax-eligible": { id: "kcpd-09", customizations: { streetExample: "I-70 and Woodland Avenue", callbackExample: "555-0142" } },
  "code-enforcement": { id: "kcpd-10", customizations: { streetExample: "1900 Troost Avenue", callbackExample: "555-0142" } },
};

export function instantiateLexDemoScenarios(
  templates: CallAssistDemoScenarioConfig[],
  overlay: Record<string, { id?: string; customizations?: AgencyDemoCustomizations }>,
): CallAssistDemoScenarioConfig[] {
  return templates.map((template) => {
    const row = overlay[template.id];
    return {
      ...template,
      id: row?.id ?? template.id,
      utterances: template.utterances.map((u) => interpolateDemoUtterance(u, row?.customizations ?? {})),
    };
  });
}

export const CALL_ASSIST_LEX_DEMO_SCENARIOS = instantiateLexDemoScenarios(
  CALL_ASSIST_LEX_DEMO_TEMPLATES,
  Object.fromEntries(
    Object.entries(GENERIC_LEX_DEMO_CUSTOMIZATIONS).map(([id, customizations]) => [id, { customizations }]),
  ),
);

/** First-tenant Lex smoke tests (kcpd-01 … kcpd-10). */
export const KCPD_LEX_DEMO_SCENARIOS = instantiateLexDemoScenarios(
  CALL_ASSIST_LEX_DEMO_TEMPLATES,
  KCPD_LEX_DEMO_CUSTOMIZATIONS,
);

export const KCPD_CARFAX_PORTAL_URL = "https://www.kcpd.org/online-reporting";

export const KCPD_VOICE_CONFIG: CallAssistAgencyVoiceConfig = {
  agencyId: "kcpd",
  agencyName: "Kansas City Missouri Police Department",
  agencyDisplayName: "Kansas City Police",
  agencyShortName: "KCPD",
  agencyTypeLabel: "Police Department",
  officerLabel: "officer",
  emergencyLine: "911",
  nonEmergencyWebsite: "kcpd.org",
  onlineReportPortalUrl: KCPD_CARFAX_PORTAL_URL,
  carfaxPortalUrl: KCPD_CARFAX_PORTAL_URL,
  defaultLanguageCode: "en-US",
  supportedLanguages: ["en-US", "es-US", "zh-CN", "zh-HK", "tl-PH", "vi-VN", "ar-AE"],
  defaultLocale: "en_US",
  supportedLocales: ["en_US", "es_US", "zh_CN", "zh_HK", "tl_PH", "vi_VN", "ar_AE"],
  disclosureText: KCPD_LEX_DISCLOSURE_TEXT,
  openingGreeting:
    "Thank you for calling the Kansas City Police non-emergency line. I'm an automated assistant. This call may be recorded. If this is a life-threatening emergency, hang up and dial 9-1-1. For all other requests, stay on the line.",
};

/** First-tenant city-services directory. Other agencies seed their own 311/parks/water entries. */
function withSeedRouting(route: Omit<ExternalAgencyRoute, "acceptedCallTypes" | "configurationStatus">): ExternalAgencyRoute {
  return {
    ...route,
    acceptedCallTypes: route.triageClassifications,
    hoursAllDay: true,
    hoursTimezone: "America/Chicago",
    afterHoursPolicy: "human",
    transferFailurePolicy: "human",
    maxAttempts: 2,
    configurationStatus: "ready",
  };
}

export function kcpdExternalAgencySeed(agencyId: string): ExternalAgencyRoute[] {
  return [
    withSeedRouting({
      agencyId,
      externalAgencyId: "kc-311",
      externalAgencyName: "311 Kansas City",
      phoneNumber: "+18165133113",
      description: "City services and non-police complaints",
      transferType: "WARM",
      callerExperienceScript: "This sounds like a city service issue. I'll connect you with 311 and share a short summary.",
      transferSummaryTemplate:
        "Warm transfer from police non-emergency assist. Issue: {issue}. Callback: {callback}. Location: {location}.",
      enabled: true,
      triageClassifications: ["PARKING", "CODE_ENFORCEMENT", "INFORMATION_REQUEST"],
    }),
    withSeedRouting({
      agencyId,
      externalAgencyId: "kc-parks",
      externalAgencyName: "Kansas City Parks and Recreation",
      phoneNumber: "+18165131313",
      description: "Parks property and recreation issues",
      transferType: "WARM",
      callerExperienceScript: "I'll transfer you to Parks and Recreation with a summary of what you reported.",
      transferSummaryTemplate:
        "Warm transfer from police non-emergency assist. Issue: {issue}. Callback: {callback}. Location: {location}.",
      enabled: true,
      triageClassifications: ["NOISE_COMPLAINT"],
    }),
    withSeedRouting({
      agencyId,
      externalAgencyId: "kc-water",
      externalAgencyName: "Kansas City Water Services",
      phoneNumber: "+18165131300",
      description: "Water main, sewer, and hydrant issues",
      transferType: "WARM",
      callerExperienceScript: "This is a water department issue. I'll connect you with Kansas City Water and share a summary.",
      transferSummaryTemplate:
        "Warm transfer from police non-emergency assist. Issue: {issue}. Callback: {callback}. Location: {location}.",
      enabled: true,
      triageClassifications: ["PUBLIC_WORKS"],
    }),
  ];
}

/** PremierOne nature codes — adapter config only. */
export const KCPD_PREMIERONE_NATURE_MAPPING: CadNatureMapping = {
  NON_EMERGENCY_POLICE: "NEPOL",
  NOISE_COMPLAINT: "NOISE",
  PARKING: "PARK",
  ANIMAL_CONTROL: "ANIMAL",
  CODE_ENFORCEMENT: "CODE",
  PUBLIC_WORKS: "PW",
  TOW_COMPLAINT: "TOW",
  REPORT_ONLY: "RPT",
  INFORMATION_REQUEST: "INFO",
  CARFAX_REPORTING_ELIGIBLE: "VEHTHFT",
  ONLINE_REPORTING_ELIGIBLE: "ONRPT",
  UNKNOWN: "UNK",
};

export type CallAssistTenantSeed = {
  profileId: "kcpd";
  disclosureEnabled: true;
  disclosureText: string;
  jurisdictionPolicyId: string;
  cadProviderId: CadProviderId;
  carfaxPortalUrl: string;
  onlineReportUrl: string;
  retention: RetentionPolicy;
  natureMapping: CadNatureMapping;
  emergencyDestination: string;
  demoEmergencyDestination: string;
};

/** Grounded FAQ copy only. No fines, medical advice, or unpublished phone numbers. */
export const KCPD_KNOWLEDGE_SEED: Array<{
  articleId: string;
  title: string;
  body: string;
  tags: string[];
}> = [
  {
    articleId: "hours",
    title: "Non-emergency hours",
    body: "The Kansas City Police non-emergency line is available 24 hours a day. This is not 911. If this is a life-threatening emergency, hang up and dial 9-1-1.",
    tags: ["hours", "hours of operation", "open", "non-emergency"],
  },
  {
    articleId: "emergency",
    title: "When to hang up and dial 911",
    body: "If someone is in immediate danger, a weapon is involved, or this is a life-threatening emergency, hang up and dial 9-1-1. Stay on this line only for non-emergency police requests.",
    tags: ["emergency", "911", "weapon", "danger"],
  },
  {
    articleId: "online-reporting",
    title: "Online reporting",
    body: "Some reports can be filed online at kcpd.org/online-reporting. A call taker can also send a link. Eligible reports include certain property and vehicle reports listed on that page.",
    tags: ["online", "report", "carfax", "website", "portal"],
  },
  {
    articleId: "towed",
    title: "Towed or impounded vehicles",
    body: "Towed and impound information is listed on kcpd.org. Bring photo identification when retrieving a vehicle. This line can take a towed-vehicle complaint and share the website.",
    tags: ["tow", "towed", "impound", "vehicle", "towed vehicle"],
  },
  {
    articleId: "records",
    title: "Police records requests",
    body: "Missouri Sunshine Law records requests are handled by the department records unit. Current instructions are on kcpd.org. This automated line cannot release case files.",
    tags: ["records", "report copy", "sunshine", "foia"],
  },
  {
    articleId: "parking",
    title: "Parking and blocked driveway",
    body: "A vehicle blocking a driveway can be a police non-emergency request. City parking meters, abandoned junk cars, and some code complaints may be routed to Kansas City 311.",
    tags: ["parking", "driveway", "blocked", "abandoned"],
  },
  {
    articleId: "city-311",
    title: "City services and 311",
    body: "Water, sewer, trash, parks, and many city-service issues belong with Kansas City 311, not police dispatch. This line can warm-transfer a summary to 311, Parks, or Water when that is the right destination.",
    tags: ["311", "water", "parks", "city", "pothole", "trash"],
  },
  {
    articleId: "languages",
    title: "Language assistance",
    body: "This non-emergency line can continue in English or Spanish and offers additional language options from the opening menu. You can also ask for a live call taker.",
    tags: ["language", "spanish", "interpreter", "translation"],
  },
];

export const KCPD_TENANT_SEED: CallAssistTenantSeed = {
  profileId: "kcpd",
  disclosureEnabled: true,
  disclosureText: KCPD_LEX_DISCLOSURE_TEXT,
  jurisdictionPolicyId: "mo-kcpd-default",
  cadProviderId: "motorola-premierone",
  carfaxPortalUrl: KCPD_CARFAX_PORTAL_URL,
  onlineReportUrl: KCPD_CARFAX_PORTAL_URL,
  retention: MISSOURI_SUNSHINE_RETENTION_POLICY,
  natureMapping: KCPD_PREMIERONE_NATURE_MAPPING,
  emergencyDestination: "911",
  demoEmergencyDestination: "+18165550111",
};
