import { MISSOURI_SUNSHINE_RETENTION_POLICY, type RetentionPolicy } from "./retention.js";
import type { ExternalAgencyRoute } from "./routing.js";
import type { CadNatureMapping, CadProviderId } from "./cad-types.js";
import type { CallAssistDemoScenarioConfig } from "./taxonomy.js";

/**
 * KCPD reference tenant configuration.
 * Apply only when CALL_ASSIST_SEED_PROFILE=kcpd (or an explicit admin seed).
 * Do not import this from Safety / Triage / Intake engines.
 */
export const KCPD_DISCLOSURE_TEXT =
  "You've reached the Kansas City Police Department non-emergency line. " +
  "This call may be handled initially by an automated assistant to gather " +
  "information and route your call. If this is an emergency, say 'emergency' " +
  "or hang up and dial 9-1-1.";

/** Spoken on the Lex/Connect non-emergency test DID. Not hardcoded in the bot. */
export const KCPD_LEX_DISCLOSURE_TEXT =
  "You are speaking with an AI assistant for the Kansas City Missouri Police Department. " +
  "This is a non-emergency line. This call is recorded.";

export const KCPD_LEX_DEMO_SCENARIOS: CallAssistDemoScenarioConfig[] = [
  {
    id: "kcpd-01",
    label: "Abandoned vehicle",
    utterances: [
      "There's an abandoned vehicle on my street",
      "It's been there for three days",
      "1847 Troost Avenue",
      "I don't know",
      "555-0142",
    ],
    expectedClass: "NonEmergencyPolice",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-02",
    label: "Noise complaint",
    utterances: ["My neighbors are having a loud party", "4200 Main Street apartment 3B", "555-0199"],
    expectedClass: "NoiseComplaint",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-03",
    label: "Welfare check",
    utterances: [
      "I'm worried about my elderly neighbor",
      "She hasn't answered the door in two days",
      "300 West 39th Street",
    ],
    expectedClass: "NonEmergencyPolice",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-04",
    label: "Parking complaint",
    utterances: ["Someone is blocking my driveway", "742 Elm Street", "It's a silver sedan", "I don't have the plate"],
    expectedClass: "ParkingComplaint",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-05",
    label: "Non-emergency theft",
    utterances: ["I want to report a theft", "My package was stolen off my porch", "1200 Grand Boulevard"],
    expectedClass: "ReportOnly",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-06",
    label: "Mid-call emergency",
    utterances: ["There's a suspicious person outside", "Actually he just pulled out a gun", "I need help now"],
    expectedClass: "EmergencyEscalation",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-07",
    label: "Parking — no plate",
    utterances: ["Car blocking fire hydrant", "Oak and 31st Street", "Red pickup truck", "No I can't see the plate"],
    expectedClass: "ParkingComplaint",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-08",
    label: "Spanish noise",
    utterances: ["Hay mucho ruido en mi vecindario", "4500 Calle Broadway"],
    expectedClass: "NoiseComplaint",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-09",
    label: "CarFax eligible",
    utterances: ["I was in a fender bender", "I need a report for insurance", "I-70 and Woodland Avenue"],
    expectedClass: "CarfaxReportingEligible",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
  {
    id: "kcpd-10",
    label: "Code enforcement",
    utterances: ["My neighbor has junk cars in their yard", "It's been months", "1900 Troost Avenue"],
    expectedClass: "CodeEnforcement",
    vertical: "911",
    source: "preset",
    enabled: true,
  },
];

export const KCPD_CARFAX_PORTAL_URL = "https://www.kcpd.org/online-reporting";

/** Placeholder numbers — replace with agency-validated DIDs before go-live. */
export function kcpdExternalAgencySeed(agencyId: string): ExternalAgencyRoute[] {
  return [
    {
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
    },
    {
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
    },
    {
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
    },
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

export const GENERIC_DISCLOSURE_TEXT =
  "You have reached the non-emergency line. An automated assistant may gather information " +
  "to route your call. If this is an emergency, say emergency or hang up and dial 9-1-1.";
